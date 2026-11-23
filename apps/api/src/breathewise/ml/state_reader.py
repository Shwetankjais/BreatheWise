"""Inspect supported pickle/joblib data opcodes without importing or calling globals.

GLOBAL, REDUCE, NEWOBJ and BUILD are recorded as inert data. No pickle.load,
joblib.load, reconstructed Python class, callable invocation or __setstate__.
Unknown encodings fail closed; this is a bounded artifact inspector, not a general
pickle implementation. Joblib ndarray framing follows its documented source.
"""

import io
import math
import pickletools
import re
from dataclasses import dataclass, field


class StateReadError(ValueError):
    pass


@dataclass
class Symbol:
    name: str
    args: tuple = ()
    state: object = None
    items: dict = field(default_factory=dict)
    array_bytes: bytes | None = None
    array_object: object = None


class StateReader:
    def __init__(self, stream: io.BytesIO, *, depth=0):
        self.stream = stream
        self.depth = depth
        self.memo = {}
        self.stack = []
        self.mark = object()
        self.symbols = []
        self.arrays = []
        self.opcode_count = 0
        if depth > 20:
            raise StateReadError("Nested array pickle depth exceeds limit")

    def marked(self):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index] is self.mark:
                values = self.stack[index + 1 :]
                del self.stack[index:]
                return values
        raise StateReadError("Missing pickle MARK")

    def symbol(self, name, args=()):
        value = Symbol(name=name, args=args)
        self.symbols.append(value)
        return value

    def array_payload(self, symbol):
        state = symbol.state
        if not isinstance(state, dict):
            raise StateReadError("Invalid joblib ndarray state")
        dtype = state.get("dtype")
        shape = state.get("shape")
        if not isinstance(dtype, Symbol) or dtype.name != "numpy.dtype" or not dtype.args:
            raise StateReadError("Unsupported ndarray dtype descriptor")
        if not isinstance(shape, tuple) or any(type(n) is not int or n < 0 for n in shape):
            raise StateReadError("Invalid ndarray shape")
        count = math.prod(shape)
        if count > 10_000_000:
            raise StateReadError("Array exceeds inspection limit")
        code = dtype.args[0]
        if not isinstance(code, str):
            raise StateReadError("Invalid ndarray dtype code")
        if code.startswith("O"):
            child = StateReader(self.stream, depth=self.depth + 1)
            symbol.array_object = child.read()
            self.symbols.extend(child.symbols)
            self.arrays.extend(child.arrays)
        else:
            match = re.fullmatch(r"([fiubmMSU])(\d+)", code)
            if not match:
                raise StateReadError(f"Unsupported array encoding {code}")
            itemsize = int(match[2]) * (4 if match[1] == "U" else 1)
            length = count * itemsize
            if length > 64 * 1024 * 1024:
                raise StateReadError("Array payload exceeds limit")
            alignment = state.get("numpy_array_alignment_bytes")
            if alignment is not None:
                if type(alignment) is not int or not 1 <= alignment <= 255:
                    raise StateReadError("Invalid ndarray alignment")
                padding = self.stream.read(1)
                if not padding or padding[0] > alignment:
                    raise StateReadError("Invalid ndarray padding")
                if self.stream.read(padding[0]) != b"\xff" * padding[0]:
                    raise StateReadError("Invalid ndarray padding bytes")
            symbol.array_bytes = self.stream.read(length)
            if len(symbol.array_bytes) != length:
                raise StateReadError("Truncated ndarray payload")
        self.arrays.append(symbol)

    def read(self):
        literals = {
            "BININT",
            "BININT1",
            "BININT2",
            "LONG",
            "LONG1",
            "LONG4",
            "BINFLOAT",
            "FLOAT",
            "BINUNICODE",
            "BINUNICODE8",
            "SHORT_BINUNICODE",
            "UNICODE",
            "BINBYTES",
            "BINBYTES8",
            "SHORT_BINBYTES",
            "BYTEARRAY8",
        }
        try:
            for opcode, arg, pos in pickletools.genops(self.stream):
                self.opcode_count += 1
                if self.opcode_count > 500_000 or len(self.stack) > 100_000:
                    raise StateReadError("Pickle inspection exceeds limits")
                name = opcode.name
                if name in {"PROTO", "FRAME"}:
                    continue
                if name in literals:
                    self.stack.append(bytes(arg) if name == "BYTEARRAY8" else arg)
                elif name in {"NEWTRUE", "NEWFALSE", "NONE"}:
                    self.stack.append({"NEWTRUE": True, "NEWFALSE": False, "NONE": None}[name])
                elif name == "MARK":
                    self.stack.append(self.mark)
                elif name in {"EMPTY_DICT", "EMPTY_LIST", "EMPTY_TUPLE", "EMPTY_SET"}:
                    self.stack.append(
                        {
                            "EMPTY_DICT": dict,
                            "EMPTY_LIST": list,
                            "EMPTY_TUPLE": tuple,
                            "EMPTY_SET": set,
                        }[name]()
                    )
                elif name in {"MEMOIZE", "BINPUT", "LONG_BINPUT", "PUT"}:
                    self.memo[len(self.memo) if name == "MEMOIZE" else int(arg)] = self.stack[-1]
                elif name in {"BINGET", "LONG_BINGET", "GET"}:
                    self.stack.append(self.memo[int(arg)])
                elif name == "GLOBAL":
                    self.stack.append(self.symbol(arg.replace(" ", ".")))
                elif name == "STACK_GLOBAL":
                    attr, module = self.stack.pop(), self.stack.pop()
                    if not isinstance(attr, str) or not isinstance(module, str):
                        raise StateReadError("Invalid global descriptor")
                    self.stack.append(self.symbol(f"{module}.{attr}"))
                elif name in {"NEWOBJ", "REDUCE"}:
                    args, constructor = self.stack.pop(), self.stack.pop()
                    if not isinstance(constructor, Symbol) or not isinstance(args, tuple):
                        raise StateReadError("Invalid symbolic constructor")
                    self.stack.append(self.symbol(constructor.name, args))
                elif name == "BUILD":
                    state = self.stack.pop()
                    symbol = self.stack[-1]
                    if not isinstance(symbol, Symbol):
                        raise StateReadError("BUILD on non-symbolic data")
                    symbol.state = state
                    if symbol.name == "joblib.numpy_pickle.NumpyArrayWrapper":
                        self.array_payload(symbol)
                elif name in {"TUPLE1", "TUPLE2", "TUPLE3"}:
                    count = int(name[-1])
                    values = tuple(self.stack[-count:])
                    del self.stack[-count:]
                    self.stack.append(values)
                elif name == "TUPLE":
                    self.stack.append(tuple(self.marked()))
                elif name in {"SETITEMS", "SETITEM"}:
                    if name == "SETITEMS":
                        values = self.marked()
                    else:
                        value, key = self.stack.pop(), self.stack.pop()
                        values = [key, value]
                    target = self.stack[-1]
                    mapping = target.items if isinstance(target, Symbol) else target
                    if not isinstance(mapping, dict) or len(values) % 2:
                        raise StateReadError("Unsupported mapping target")
                    for index in range(0, len(values), 2):
                        key = values[index]
                        if type(key) not in {str, int, float, bytes}:
                            raise StateReadError("Unsupported mapping key")
                        mapping[key] = values[index + 1]
                elif name in {"APPEND", "APPENDS"}:
                    values = self.marked() if name == "APPENDS" else [self.stack.pop()]
                    if not isinstance(self.stack[-1], list):
                        raise StateReadError("Unsupported sequence target")
                    self.stack[-1].extend(values)
                elif name == "POP":
                    self.stack.pop()
                elif name == "POP_MARK":
                    self.marked()
                elif name == "DUP":
                    self.stack.append(self.stack[-1])
                elif name == "STOP":
                    if len(self.stack) != 1:
                        raise StateReadError("Unexpected final pickle stack")
                    return self.stack[0]
                else:
                    raise StateReadError(f"Unsupported opcode {name} at byte {pos}")
        except (ValueError, IndexError, KeyError, TypeError) as exc:
            raise StateReadError(f"Artifact state inspection stopped: {exc}") from exc
        raise StateReadError("Missing pickle STOP")


def inspect_state(data: bytes):
    if len(data) > 64 * 1024 * 1024:
        raise StateReadError("Artifact exceeds 64 MiB inspection limit")
    stream = io.BytesIO(data)
    reader = StateReader(stream)
    root = reader.read()
    if stream.tell() != len(data):
        raise StateReadError("Unexpected trailing artifact bytes")
    return root, reader

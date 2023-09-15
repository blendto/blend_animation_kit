import 'dart:typed_data';

abstract class Float64ListSerializer {
  static Float64List deserialize(Object json) {
    if (json is! Iterable) {
      throw UnimplementedError(
          "Expected `Iterable` but received ${json.runtimeType} for deserialization");
    }
    return Float64List.fromList(
        json.cast<num>().map((e) => e.toDouble()).toList(growable: false));
  }
}

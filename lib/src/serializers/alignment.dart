import 'package:flutter/material.dart';

abstract class AlignmentSerializer {
  static String serialize(Alignment alignment) {
    return '${alignment.x},${alignment.y}';
  }

  static Alignment deserialize(String alignmentString) {
    final parts = alignmentString.split(',');
    if (parts.length == 2) {
      final x = double.tryParse(parts[0]);
      final y = double.tryParse(parts[1]);
      if (x != null && y != null) {
        return Alignment(x, y);
      }
    }
    throw UnimplementedError(
        "Cannot deserialize $alignmentString to Alignment");
  }
}

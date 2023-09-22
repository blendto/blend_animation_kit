import 'package:flutter/material.dart';
import 'package:vector_math/vector_math_64.dart';

extension WrapAlignmentExtension on TextAlign {
  Alignment toAlignment() {
    switch (this) {
      case TextAlign.center:
        return Alignment.center;
      case TextAlign.end:
      case TextAlign.right:
        return Alignment.centerRight;
      default:
        return Alignment.centerLeft;
    }
  }
}

extension Vector3Extension on Vector3 {
  Vector3 scaleXYTranslation(double scale) {
    final newVec = Vector3.copy(this);
    newVec.x = x * scale;
    newVec.y = y * scale;
    return newVec;
  }
}

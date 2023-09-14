import 'package:flutter/material.dart';

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

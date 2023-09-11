import 'package:flutter/material.dart';

extension WrapAlignmentExtension on TextAlign {
  WrapAlignment toWrapAlignment() {
    switch (this) {
      case TextAlign.start:
        return WrapAlignment.start;
      case TextAlign.center:
        return WrapAlignment.center;
      case TextAlign.end:
      case TextAlign.right:
        return WrapAlignment.end;
      default:
        return WrapAlignment.spaceAround;
    }
  }
}

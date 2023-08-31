import 'package:flutter/animation.dart';

class ValueTween<T> extends Tween<T> {
  /// Create a tween whose [begin] and [end] values equal [value].
  ValueTween({required T begin, required T end})
      : super(begin: begin, end: end);

  @override
  T lerp(double t) {
    if (t <= 0.5) {
      return begin!;
    }
    return end!;
  }
}

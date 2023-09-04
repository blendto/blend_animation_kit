import 'package:flutter/cupertino.dart';
import 'package:simple_animations/simple_animations.dart';

abstract class CustomMovieTweenProperty<T> extends MovieTweenProperty<T> {
  T get fallbackValue;

  /// Returns the current or [null] of this property.
  /// Should be improved
  T? fromOrNull(Movie movie) {
    try {
      return from(movie);
    } catch (er) {
      return null;
    }
  }

  /// Returns the current or [fallbackValue] of this property.
  T fromOrDefault(Movie movie) {
    return fromOrNull(movie) ?? fallbackValue;
  }
}

class TransformationProperty extends CustomMovieTweenProperty<Matrix4> {
  @override
  final fallbackValue = Matrix4.identity();
}

class OpacityProperty extends CustomMovieTweenProperty<double> {
  @override
  final fallbackValue = 1.0;
}

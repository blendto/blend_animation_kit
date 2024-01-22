import 'package:blend_animation_kit/src/matrix4_alignment_tween.dart';
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

class TransformationProperty
    extends CustomMovieTweenProperty<Matrix4WithAlignment> {
  @override
  final fallbackValue = Matrix4WithAlignment(
      matrix: Matrix4.identity(), transformAlignment: Alignment.center);
}

class OpacityProperty extends CustomMovieTweenProperty<double> {
  @override
  final fallbackValue = 1.0;
}

class RectangularMaskProperty extends CustomMovieTweenProperty<EdgeInsets> {
  @override
  final fallbackValue = EdgeInsets.zero;
}

class AnimationProperty {
  final transformation = TransformationProperty();
  final opacity = OpacityProperty();
  final rectangularMask = RectangularMaskProperty();
}

abstract class SceneItem {
  Duration get duration;

  Duration get from;

  void attachToScene(MovieTween tween);
}

class ScenePropertyItem<T> implements SceneItem {
  final CustomMovieTweenProperty property;
  final Animatable<T> tween;
  final Curve curve;
  @override
  final Duration from;

  @override
  final Duration duration;

  const ScenePropertyItem({
    required this.property,
    required this.tween,
    required this.curve,
    required this.from,
    required this.duration,
  });

  @override
  void attachToScene(MovieTween movieTween) {
    movieTween.tween(
      property,
      tween,
      curve: curve,
      begin: from,
      duration: duration,
    );
  }
}

class PauseScene implements SceneItem {
  @override
  final Duration duration;
  @override
  final Duration from;

  const PauseScene({required this.duration, required this.from});

  @override
  void attachToScene(MovieTween movieTween) {
    movieTween.scene(
      begin: from,
      duration: duration,
    );
  }
}

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

abstract class AnimationBuilder<T extends AnimationBuilder<T>> {
  late final Iterable<SceneItem> sceneItems;

  late final MovieTween tween;

  late final Duration begin;

  List<AnimationProperty> get animationProperties;

  T copyWith({List<SceneItem>? sceneItems, Duration? begin});

  MovieTween generateTween();

  T add(final PipelineStep<T> pipelineStep);
}

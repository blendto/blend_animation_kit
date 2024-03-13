import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

@immutable
class BlendAnimationBuilder {
  late final Iterable<SceneItem> sceneItems;

  late final Duration begin;

  late final MovieTween tween = generateTween();

  List<AnimationProperty> get animationProperties =>
      animationInput.animationProperties;

  final BlendAnimationInput animationInput;

  BlendAnimationBuilder(this.animationInput)
      : begin = Duration.zero,
        sceneItems = [];

  BlendAnimationBuilder._({
    required this.animationInput,
    required this.sceneItems,
    required this.begin,
  });

  BlendAnimationBuilder copyWith({
    List<SceneItem>? sceneItems,
    Duration? begin,
  }) {
    return BlendAnimationBuilder._(
      animationInput: animationInput,
      sceneItems: sceneItems ?? this.sceneItems,
      begin: begin ?? this.begin,
    );
  }

  MovieTween generateTween() {
    MovieTween movieTween = MovieTween();
    for (final element in sceneItems) {
      element.attachToScene(movieTween);
    }
    return movieTween;
  }

  BlendAnimationBuilder add(
    final PipelineStep pipelineStep,
  ) {
    PipelineStep? pipelineIterator = pipelineStep;
    BlendAnimationBuilder updatedBuilder = this;
    while (pipelineIterator != null) {
      updatedBuilder = pipelineIterator.updatedBuilder(updatedBuilder);
      pipelineIterator = pipelineIterator.nextStep;
    }
    return updatedBuilder;
  }
}

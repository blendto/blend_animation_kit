import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

@immutable
class BaseAnimationBuilder {
  late final Iterable<SceneItem> sceneItems;

  late final Duration begin;

  late final MovieTween tween = generateTween();

  List<AnimationProperty> get animationProperties =>
      animationInput.animationProperties;

  final AnimationInput animationInput;

  BaseAnimationBuilder(this.animationInput)
      : begin = Duration.zero,
        sceneItems = [];

  BaseAnimationBuilder._({
    required this.animationInput,
    required this.sceneItems,
    required this.begin,
  });

  BaseAnimationBuilder copyWith(
      {List<SceneItem>? sceneItems, Duration? begin}) {
    return BaseAnimationBuilder._(
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

  BaseAnimationBuilder add(
    final PipelineStep pipelineStep,
  ) {
    PipelineStep? pipelineIterator = pipelineStep;
    BaseAnimationBuilder updatedBuilder = this;
    while (pipelineIterator != null) {
      updatedBuilder = pipelineIterator.updatedBuilder(updatedBuilder);
      pipelineIterator = pipelineIterator.nextStep;
    }
    return updatedBuilder;
  }
}

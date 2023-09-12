import 'package:blend_animation_kit/src/animation_input.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

import '../blend_animation_kit.dart';

@immutable
class TextAnimationBuilder {
  late final Iterable<SceneItem> sceneItems;

  late final Duration begin;

  late final MovieTween tween = _generateTween();

  List<AnimationProperty> get animationProperties =>
      animationInput.animationProperties;

  final AnimationInput animationInput;

  TextAnimationBuilder(this.animationInput)
      : begin = Duration.zero,
        sceneItems = [];

  TextAnimationBuilder._({
    required this.animationInput,
    required this.sceneItems,
    required this.begin,
  });

  TextAnimationBuilder copyWith(
      {List<SceneItem>? sceneItems, Duration? begin}) {
    return TextAnimationBuilder._(
      animationInput: animationInput,
      sceneItems: sceneItems ?? this.sceneItems,
      begin: begin ?? this.begin,
    );
  }

  MovieTween _generateTween() {
    MovieTween movieTween = MovieTween();
    for (final element in sceneItems) {
      element.attachToScene(movieTween);
    }
    return movieTween;
  }

  TextAnimationBuilder add(final PipelineStep pipelineStep) {
    PipelineStep? pipelineIterator = pipelineStep;
    TextAnimationBuilder updatedBuilder = this;
    while (pipelineIterator != null) {
      updatedBuilder = pipelineIterator.updatedBuilder(updatedBuilder);
      pipelineIterator = pipelineIterator.nextStep;
    }
    print(variant4Pipeline);

    print("${animationInput.text}:-> $pipelineStep");
    return updatedBuilder;
  }
}

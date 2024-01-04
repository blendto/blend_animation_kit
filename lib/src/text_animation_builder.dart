import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/base_animation_builder.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

@immutable
class TextAnimationBuilder extends AnimationBuilder<TextAnimationBuilder> {
  @override
  late final Iterable<SceneItem> sceneItems;

  @override
  late final Duration begin;

  @override
  late final MovieTween tween = generateTween();

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

  @override
  TextAnimationBuilder copyWith(
      {List<SceneItem>? sceneItems, Duration? begin}) {
    return TextAnimationBuilder._(
      animationInput: animationInput,
      sceneItems: sceneItems ?? this.sceneItems,
      begin: begin ?? this.begin,
    );
  }

  @override
  MovieTween generateTween() {
    MovieTween movieTween = MovieTween();
    for (final element in sceneItems) {
      element.attachToScene(movieTween);
    }
    return movieTween;
  }

  @override
  TextAnimationBuilder add(
    final PipelineStep<TextAnimationBuilder> pipelineStep,
  ) {
    PipelineStep<TextAnimationBuilder>? pipelineIterator = pipelineStep;
    TextAnimationBuilder updatedBuilder = this;
    while (pipelineIterator != null) {
      updatedBuilder = pipelineIterator.updatedBuilder(updatedBuilder);
      pipelineIterator = pipelineIterator.nextStep;
    }
    return updatedBuilder;
  }
}

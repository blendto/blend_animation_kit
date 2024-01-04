import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/widget_animation_input.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

import 'base_animation_builder.dart';

@immutable
class WidgetAnimationBuilder extends AnimationBuilder<WidgetAnimationBuilder> {
  @override
  late final Iterable<SceneItem> sceneItems;

  late final Duration begin;

  late final MovieTween tween = generateTween();

  List<AnimationProperty> get animationProperties =>
      [animationInput.animationProperty];

  final WidgetAnimationInput animationInput;

  WidgetAnimationBuilder(this.animationInput)
      : begin = Duration.zero,
        sceneItems = [];

  WidgetAnimationBuilder._({
    required this.animationInput,
    required this.sceneItems,
    required this.begin,
  });

  @override
  WidgetAnimationBuilder copyWith(
      {List<SceneItem>? sceneItems, Duration? begin}) {
    return WidgetAnimationBuilder._(
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
  WidgetAnimationBuilder add(
      final PipelineStep<WidgetAnimationBuilder> pipelineStep) {
    PipelineStep<WidgetAnimationBuilder>? pipelineIterator = pipelineStep;
    WidgetAnimationBuilder updatedBuilder = this;
    while (pipelineIterator != null) {
      updatedBuilder = pipelineIterator.updatedBuilder(updatedBuilder);
      pipelineIterator = pipelineIterator.nextStep;
    }
    return updatedBuilder;
  }
}

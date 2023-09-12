import 'package:blend_animation_kit/src/animation_input.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/matrix4_alignment_tween.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/animation_builder/loop_animation_builder.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

@immutable
class TextAnimationBuilder {
  late final Iterable<SceneItem> sceneItems;

  late final Duration begin;

  late final MovieTween tween = _generateTween();

  Iterable<String> get _groups => animationInput.groups;

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
    return updatedBuilder;
  }

  Widget generateWidget() {
    return LoopAnimationBuilder(
      tween: tween,
      builder: (context, movie, _) {
        return Text.rich(
          TextSpan(
            children: _groups.indexed.map((char) {
              final index = char.$1;
              final value = char.$2;

              final animationProperty = animationProperties.elementAt(index);
              return WidgetSpan(
                child: Opacity(
                  opacity: animationProperty.opacity
                      .fromOrDefault(movie)
                      .clamp(0, 1),
                  child: Transform(
                    alignment: animationProperty.transformation
                        .fromOrDefault(movie)
                        .transformAlignment,
                    transform: animationProperty.transformation
                        .fromOrDefault(movie)
                        .matrix,
                    child: Text(value, style: animationInput.textStyle),
                  ),
                ),
              );
            }).toList(),
          ),
        );
      },
      duration: tween.duration,
    );
  }
}

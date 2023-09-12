import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/animation_builder/loop_animation_builder.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

class TextAnimationWidget extends StatelessWidget {
  final PipelineStep pipelineStep;
  final AnimationInput animationInput;
  final TextStyle? textStyle;

  final TextAnimationBuilder _builder;

  TextAnimationWidget({
    super.key,
    required this.pipelineStep,
    required this.animationInput,
    this.textStyle,
  }) : _builder = TextAnimationBuilder(animationInput).add(pipelineStep);

  MovieTween get tween => _builder.tween;

  List<AnimationProperty> get animationProperties =>
      _builder.animationProperties;

  @override
  Widget build(BuildContext context) {
    return LoopAnimationBuilder(
      tween: tween,
      builder: (context, movie, _) {
        return Text.rich(
          TextSpan(
            children: animationInput.groups.indexed.map((char) {
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
                    child: Text(value, style: textStyle),
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
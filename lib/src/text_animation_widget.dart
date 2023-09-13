import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/extensions.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/animation_builder/loop_animation_builder.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

class TextAnimationWidget extends StatelessWidget {
  final TextStyle? textStyle;

  final TextAnimationBuilder builder;

  final TextAlign textAlign;

  const TextAnimationWidget({
    super.key,
    required this.builder,
    this.textStyle,
    this.textAlign = TextAlign.center,
  });

  factory TextAnimationWidget.fromInput({
    required CharacterAnimationInput animationInput,
    TextStyle? textStyle,
    required PipelineStep pipelineStep,
  }) {
    return TextAnimationWidget(
      builder: TextAnimationBuilder(animationInput).add(pipelineStep),
      textStyle: textStyle,
    );
  }

  MovieTween get tween => builder.tween;

  List<AnimationProperty> get animationProperties =>
      builder.animationProperties;

  AnimationInput get animationInput => builder.animationInput;

  List<List<Widget>> getWidgets(Movie movie) {
    final groups = animationInput.groups.indexed;
    final List<List<Widget>> spans = [];
    final innerSpan = <Widget>[];
    for (final text in groups) {
      final animationProperty = animationProperties.elementAt(text.$1);
      innerSpan.add(Opacity(
        opacity: animationProperty.opacity.fromOrDefault(movie).clamp(0, 1),
        child: Transform(
          alignment: animationProperty.transformation
              .fromOrDefault(movie)
              .transformAlignment,
          transform:
              animationProperty.transformation.fromOrDefault(movie).matrix,
          child: Text(
            text.$2,
            textAlign: TextAlign.center,
            style: textStyle,
          ),
        ),
      ));
      if (text.$2 == " ") {
        spans.add(innerSpan.toList());
        innerSpan.clear();
      }
    }
    if (innerSpan.isNotEmpty) {
      spans.add(innerSpan);
    }
    return spans;
  }

  @override
  Widget build(BuildContext context) {
    return LoopAnimationBuilder(
      tween: tween,
      builder: (context, movie, _) {
        return Wrap(
          alignment: textAlign.toWrapAlignment(),
          direction: Axis.horizontal,
          children: getWidgets(movie)
              .map((e) => Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: e,
                  ))
              .toList(),
        );
      },
      duration: tween.duration,
    );
  }
}

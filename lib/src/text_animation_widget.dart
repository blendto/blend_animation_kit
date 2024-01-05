import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/simple_animations.dart';

class AnimationWidget extends StatelessWidget {
  final BaseAnimationBuilder builder;

  final bool loop;

  const AnimationWidget({
    super.key,
    required this.builder,
    this.loop = true,
  });

  factory AnimationWidget.fromInput({
    required CharacterAnimationInput animationInput,
    TextStyle? textStyle,
    required PipelineStep pipelineStep,
    TextAlign textAlign = TextAlign.center,
  }) {
    return AnimationWidget(
      builder: BaseAnimationBuilder(animationInput).add(pipelineStep),
    );
  }

  MovieTween get tween => builder.tween;

  List<AnimationProperty> get animationProperties =>
      builder.animationProperties;

  AnimationInput get animationInput => builder.animationInput;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: animationInput.alignment,
      child: LayoutBuilder(builder: (context, constraints) {
        final boxInfo =
            animationInput.getAnimationGroupDetails(context, constraints);
        return SizedBox.fromSize(
          size: boxInfo.overallBoxSize,
          child: CustomAnimationBuilder(
            tween: tween,
            control: loop ? Control.loop : Control.play,
            builder: (context, movie, child) {
              return Stack(
                clipBehavior: Clip.none,
                children: boxInfo.boxes
                    .map((info) => animationInput.renderAnimation(info, movie))
                    .toList(growable: false),
              );
            },
            duration: tween.duration,
          ),
        );
      }),
    );
  }
}

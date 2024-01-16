import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/simple_animations.dart';

class BlendAnimationWidget extends StatelessWidget {
  final BlendAnimationBuilder builder;

  final bool loop;

  /// [loop] is ignored when [control] is set
  final Control? control;

  const BlendAnimationWidget({
    super.key,
    required this.builder,
    this.loop = true,
    this.control,
  });

  factory BlendAnimationWidget.fromInput({
    required BlendAnimationInput animationInput,
    required PipelineStep pipelineStep,
  }) {
    return BlendAnimationWidget(
      builder: BlendAnimationBuilder(animationInput).add(pipelineStep),
    );
  }

  MovieTween get tween => builder.tween;

  List<AnimationProperty> get animationProperties =>
      builder.animationProperties;

  BlendAnimationInput get animationInput => builder.animationInput;

  Control get derivedControl => control ?? (loop ? Control.loop : Control.play);

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
            control: derivedControl,
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

import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/widget_animation_builder.dart';
import 'package:blend_animation_kit/src/widget_animation_input.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/simple_animations.dart';

class AnimationWidget extends StatelessWidget {
  final WidgetAnimationBuilder builder;
  final Size boxSize;

  final bool loop;

  const AnimationWidget({
    super.key,
    required this.builder,
    required this.boxSize,
    this.loop = true,
  });

  MovieTween get tween => builder.tween;

  AnimationProperty get animationProperty => builder.animationProperties[0];

  WidgetAnimationInput get animationInput => builder.animationInput;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      return SizedBox.fromSize(
        size: boxSize,
        child: CustomAnimationBuilder(
          tween: tween,
          control: loop ? Control.loop : Control.play,
          builder: (context, movie, child) {
            return Stack(
              clipBehavior: Clip.none,
              children: [renderCharacterAnimation(movie)],
            );
          },
          duration: tween.duration,
        ),
      );
    });
  }

  Positioned renderCharacterAnimation(Movie movie) {
    return Positioned(
      top: 0,
      left: 0,
      child: Opacity(
        opacity: animationProperty.opacity.fromOrDefault(movie).clamp(0, 1),
        child: Transform(
          alignment: animationProperty.transformation
              .fromOrDefault(movie)
              .transformAlignment,
          transform:
              animationProperty.transformation.fromOrDefault(movie).matrix,
          child: animationInput.widget,
        ),
      ),
    );
  }
}

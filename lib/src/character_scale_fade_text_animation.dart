import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/sequence_animation_tag.dart';
import 'package:flutter/material.dart';

import 'helpers/flutter_sequence_animation/flutter_sequence_animation.dart';

class CharacterScaleFadeTextAnimation extends StatefulWidget {
  final String text;
  final TextStyle? textStyle;

  const CharacterScaleFadeTextAnimation(
      {super.key, required this.text, this.textStyle});

  @override
  State<CharacterScaleFadeTextAnimation> createState() =>
      _CharacterScaleFadeTextAnimationState();
}

class _CharacterScaleFadeTextAnimationState
    extends State<CharacterScaleFadeTextAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final SequenceAnimation sequenceAnimation;

  final sequenceStartPositionTag =
      const SequenceAnimationTag<double>('start-position');
  final fadeOutAnimationTag =
      const SequenceAnimationTag<double>('fade-out-animation');
  final charOpacityAnimations =
      SequenceAnimationTagList<double>(tagId: "char-opacity");
  final charScaleAnimations =
      SequenceAnimationTagList<double>(tagId: "char-scaling");

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this);
    final animationBuilder = SequenceAnimationBuilder();

    animationBuilder.addAnimatable(
      animatable: ConstantTween(0.0),
      from: Duration.zero,
      to: Duration.zero,
      tag: sequenceStartPositionTag,
    );

    for (var (index, _) in widget.text.characters.indexed) {
      final opacityAnimationTag = charOpacityAnimations.addTag();
      final scaleAnimationTag = charScaleAnimations.addTag();

      animationBuilder
          .addAnimatableAfterLastOneWithTag(
            animatable: Tween(begin: 0.0, end: 1.0),
            tag: opacityAnimationTag,
            delay: Duration(milliseconds: 70 * index),
            duration: const Duration(milliseconds: 950),
            curve: Curves.easeOutExpo,
            lastTag: sequenceStartPositionTag,
          )
          .addAnimatableAfterLastOneWithTag(
            animatable: Tween(begin: 4.0, end: 1.0),
            tag: scaleAnimationTag,
            delay: Duration(milliseconds: 70 * index),
            duration: const Duration(milliseconds: 950),
            curve: Curves.easeOutExpo,
            lastTag: sequenceStartPositionTag,
          );
    }

    sequenceAnimation = animationBuilder
        .addAnimatableAfterLastOne(
          curve: Curves.easeOutExpo,
          animatable: Tween(begin: 1.0, end: 0.0),
          duration: const Duration(seconds: 1),
          delay: const Duration(seconds: 1),
          tag: fadeOutAnimationTag,
        )
        .animate(_controller);
    _controller.repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      builder: (context, child) {
        return Opacity(
          opacity: sequenceAnimation.get(fadeOutAnimationTag).value,
          child: Text.rich(
            TextSpan(
              children: widget.text.characters.indexed.map((char) {
                final index = char.$1;
                final value = char.$2;
                return WidgetSpan(
                  child: Opacity(
                    opacity: charOpacityAnimations
                        .getAnimation(sequenceAnimation, index)
                        .value,
                    child: Transform.scale(
                      scale: charScaleAnimations
                          .getAnimation(sequenceAnimation, index)
                          .value,
                      child: Text(value, style: widget.textStyle),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        );
      },
      animation: _controller,
    );
  }
}

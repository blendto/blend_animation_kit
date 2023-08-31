import 'package:flutter/material.dart';

import 'helpers/flutter_sequence_animation.dart';

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

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this);
    final animationBuilder = SequenceAnimationBuilder();

    animationBuilder.addAnimatable(
      animatable: ConstantTween(0.0),
      from: Duration.zero,
      to: Duration.zero,
      tag: "character",
    );

    for (var (index, _) in widget.text.characters.indexed) {
      animationBuilder
          .addAnimatableAfterLastOneWithTag(
            animatable: Tween(begin: 0.0, end: 1.0),
            tag: "opacity-$index",
            delay: Duration(milliseconds: 70 * index),
            duration: const Duration(milliseconds: 950),
            curve: Curves.easeOutExpo,
            lastTag: "character",
          )
          .addAnimatableAfterLastOneWithTag(
            animatable: Tween(begin: 4.0, end: 1.0),
            tag: "scale-$index",
            delay: Duration(milliseconds: 70 * index),
            duration: const Duration(milliseconds: 950),
            curve: Curves.easeOutExpo,
            lastTag: "character",
          );
    }

    sequenceAnimation = animationBuilder
        .addAnimatableAfterLastOne(
          curve: Curves.easeOutExpo,
          animatable: Tween(begin: 1.0, end: 0.0),
          duration: const Duration(seconds: 1),
          delay: const Duration(seconds: 1),
          tag: "fadeOut",
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
          opacity: sequenceAnimation['fadeOut'].value,
          child: Text.rich(
            TextSpan(
              children: widget.text.characters.indexed.map((char) {
                final index = char.$1;
                final value = char.$2;
                return WidgetSpan(
                  child: Opacity(
                    opacity: sequenceAnimation['opacity-$index'].value,
                    child: Transform.scale(
                      scale: sequenceAnimation['scale-$index'].value,
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

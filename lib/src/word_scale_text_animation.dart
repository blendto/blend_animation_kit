import 'package:custom_text_animations/src/helpers/flutter_sequence_animation.dart';
import 'package:flutter/material.dart';

class WordScaleTextAnimation extends StatefulWidget {
  final String text;
  final TextStyle? textStyle;

  const WordScaleTextAnimation({super.key, required this.text, this.textStyle});

  @override
  State<WordScaleTextAnimation> createState() => _WordScaleTextAnimationState();
}

class _WordScaleTextAnimationState extends State<WordScaleTextAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late final SequenceAnimation sequenceAnimation;

  Iterable<String> words = [];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this);
    final animationBuilder = SequenceAnimationBuilder();

    words = widget.text.split(" ");
    const durationIn = Duration(milliseconds: 800);
    const durationOut = Duration(milliseconds: 600);

    for (var (index, _) in words.indexed) {
      animationBuilder.addAnimatableUsingDuration(
        animatable: ConstantTween(index),
        tag: "word-index",
        start: animationBuilder.getCurrentDuration(),
        duration: Duration.zero,
      );

      animationBuilder
          .addAnimatableAfterLastOneWithTag(
            animatable: Tween(begin: 0.0, end: 1.0),
            tag: "word-fade",
            curve: Curves.easeInExpo,
            duration: durationIn,
            lastTag: "word-index",
          )
          .addAnimatableAfterLastOneWithTag(
            animatable: Tween(begin: 0.2, end: 1.0),
            tag: "word-scale",
            curve: Curves.easeInExpo,
            duration: durationIn,
            lastTag: "word-index",
          );

      animationBuilder.addAnimatableAfterLastOne(
        animatable: ConstantTween(0),
        tag: "word-pause",
        duration: const Duration(seconds: 1),
      );

      animationBuilder
          .addAnimatableAfterLastOneWithTag(
            animatable: Tween(begin: 1.0, end: 3.0),
            tag: "word-scale",
            curve: Curves.easeOutExpo,
            duration: durationOut,
            lastTag: "word-pause",
          )
          .addAnimatableAfterLastOneWithTag(
            animatable: Tween(begin: 1.0, end: 0.0),
            tag: "word-fade",
            curve: Curves.easeOutExpo,
            duration: durationOut,
            lastTag: "word-pause",
          );

      animationBuilder.addAnimatableUsingDuration(
        animatable: ConstantTween(index),
        tag: "word-index",
        start: animationBuilder.getCurrentDuration(),
        duration: Duration.zero,
      );
    }

    sequenceAnimation = animationBuilder
        .addAnimatableAfterLastOne(
          curve: Curves.easeOutExpo,
          animatable: ConstantTween(0),
          duration: const Duration(milliseconds: 500),
          tag: "no-op",
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
        final int currentIndex = sequenceAnimation['word-index'].value;
        return Opacity(
          opacity: sequenceAnimation['word-fade'].value,
          child: Transform.scale(
            scale: sequenceAnimation['word-scale'].value,
            child: Text(
              words.elementAt(currentIndex),
              style: widget.textStyle,
            ),
          ),
        );
      },
      animation: _controller,
    );
  }
}

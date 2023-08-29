import 'package:animated_text_kit/animated_text_kit.dart';
import 'package:custom_text_animations/custom_text_animations.dart';
import 'package:flutter/material.dart';

class SunnyMorningAnimation extends TextAnimationWidget {
  const SunnyMorningAnimation(
      {super.key, required super.text, required super.textStyle});

  @override
  List<AnimatedText> get animations => [
        ScaleOpacityCharacterAnimation(
          text: text,
          duration: const Duration(seconds: 2),
          textStyle: textStyle,
        ),
      ];
}

class ScaleOpacityCharacterAnimation extends AnimatedText {
  final Curve curve;

  final Duration speed;

  @override
  Widget completeText(BuildContext context) => Container();

  ScaleOpacityCharacterAnimation({
    required super.text,
    required super.duration,
    super.textStyle,
    super.textAlign,
    this.speed = const Duration(milliseconds: 70),
    this.curve = Curves.easeOutExpo,
  });

  late Animation<int> _charsAnimation;
  late Animation<double> _fadeAnimation;

  @override
  Duration get remaining =>
      speed * (textCharacters.length - _charsAnimation.value);

  List<InlineSpan> charWidgets = [];

  @override
  void initAnimation(AnimationController controller) {
    _charsAnimation =
        IntTween(begin: 0, end: textCharacters.length).animate(CurvedAnimation(
      parent: controller,
      curve: Interval(0, 0.7, curve: curve),
    ));

    _fadeAnimation = Tween(begin: 1.0, end: 0.0).animate(CurvedAnimation(
      parent: controller,
      curve: Interval(0.8, 1.0, curve: curve),
    ));
  }

  @override
  Widget animatedBuilder(BuildContext context, Widget? child) {
    final count = _charsAnimation.value;

    return Align(
      alignment: Alignment.centerLeft,
      child: Opacity(
        opacity: _fadeAnimation.value,
        child: Text.rich(
          TextSpan(
            children: text.split('').take(count).map((e) {
              return WidgetSpan(
                child: ScaleAndOpacityAnimation(
                  duration: const Duration(milliseconds: 70),
                  scaleTween: Tween(begin: 2, end: 1),
                  child: Text(e, style: textStyle, textAlign: textAlign),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

class ScaleAndOpacityAnimation extends StatefulWidget {
  final Duration duration;
  final Tween<double> scaleTween;
  final Widget child;
  final Curve curve;

  const ScaleAndOpacityAnimation({
    super.key,
    required this.duration,
    required this.scaleTween,
    required this.child,
    this.curve = Curves.easeOutExpo,
  });

  @override
  State<ScaleAndOpacityAnimation> createState() =>
      _ScaleAndOpacityAnimationState();
}

class _ScaleAndOpacityAnimationState extends State<ScaleAndOpacityAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController animationController;

  @override
  void initState() {
    super.initState();
    animationController =
        AnimationController(vsync: this, duration: widget.duration);
    animationController.forward();
  }

  @override
  void dispose() {
    animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: Tween(begin: 0.0, end: 1.0)
          .chain(CurveTween(curve: widget.curve))
          .evaluate(animationController),
      child: Transform.scale(
        scale: widget.scaleTween.evaluate(animationController),
        child: widget.child,
      ),
    );
  }
}

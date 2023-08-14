import 'package:animated_text_kit/animated_text_kit.dart';
import 'package:custom_text_animations/custom_text_animations.dart';
import 'package:flutter/material.dart';

class ScaleFade extends TextAnimationWidget {
  const ScaleFade(
      {super.key, required super.text, required super.textStyle});

  @override
  List<AnimatedText> get animations => [
    ScaleOpacityCharacterAnimation(
      text: text,
      duration: const Duration(seconds: 1),
      textStyle: textStyle,
    ),
  ];
}

class ScaleOpacityCharacterAnimation extends AnimatedText {
  final Curve curve;

  final Duration speed;

  @override
  Widget completeText(BuildContext context) => Text.rich(
    TextSpan(
      children: textCharacters.map((e) {
        return WidgetSpan(
          child: Text(
            e,
            style: textStyle,
            textAlign: textAlign,
          ),
        );
      }).toList(),
    ),
  );

  ScaleOpacityCharacterAnimation({
    required super.text,
    required super.duration,
    super.textStyle,
    super.textAlign,
    this.speed = const Duration(milliseconds: 70),
    this.curve = Curves.easeOutExpo,
  });

  late Animation<double> _typingText;

  @override
  Duration get remaining => speed * (textCharacters.length - _typingText.value);

  List<InlineSpan> charWidgets = [];

  @override
  void initAnimation(AnimationController controller) {
    _typingText = CurveTween(
      curve: curve,
    ).animate(controller);
  }

  @override
  Widget animatedBuilder(BuildContext context, Widget? child) {
    final count =
    (_typingText.value.clamp(0, 1) * textCharacters.length).round();

    return Stack(
      children: [
        if (child != null)
          Visibility.maintain(
            visible: false,
            child: child,
          ),
        Text.rich(
          TextSpan(
            children: textCharacters.take(count).map((e) {
              return WidgetSpan(
                child: ScaleAndOpacityAnimation(
                  duration: const Duration(milliseconds: 70),
                  scaleTween: Tween(begin: 4, end: 1),
                  child: Text(e, style: textStyle, textAlign: textAlign),
                ),
              );
            }).toList(),
          ),
        )
      ],
    );
  }
}

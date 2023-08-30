import 'package:animated_text_kit/animated_text_kit.dart';
import 'package:custom_text_animations/custom_text_animations.dart';
import 'package:custom_text_animations/src/helpers/scale_and_opacity_animation.dart';
import 'package:flutter/material.dart';

class CharacterScaleFadeTextAnimation extends TextAnimationWidget {
  const CharacterScaleFadeTextAnimation(
      {super.key, required super.text, required super.textStyle});

  String get renderedText => stripNewLine ? text.replaceAll("\n", " ") : text;

  @override
  List<AnimatedText> get animations => [
        ScaleOpacityCharacterAnimation(
          text: renderedText,
          speed: const Duration(milliseconds: 70),
          fadeOutDuration: const Duration(seconds: 1),
          fadeOutDelayDuration: const Duration(seconds: 1),
          textStyle: textStyle,
          scalingFactor: 2,
          characterFadeInDuration: const Duration(milliseconds: 950),
          characterScaleDuration: const Duration(milliseconds: 950),
        ),
      ];
}

class ScaleOpacityCharacterAnimation extends AnimatedText {
  final Curve curve;

  final Duration speed;

  final Duration characterFadeInDuration;
  final Duration characterScaleDuration;
  final Duration fadeOutDuration;
  final Duration fadeOutDelayDuration;

  final double scalingFactor;

  @override
  Widget completeText(BuildContext context) => Visibility.maintain(
        visible: false,
        child: Text.rich(
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
        ),
      );

  ScaleOpacityCharacterAnimation({
    required super.text,
    super.textStyle,
    super.textAlign,
    this.scalingFactor = 2,
    required this.characterFadeInDuration,
    required this.characterScaleDuration,
    required this.fadeOutDuration,
    required this.fadeOutDelayDuration,
    this.curve = Curves.easeOutExpo,
    required this.speed,
  }) : super(
            duration: (speed * text.characters.length) +
                fadeOutDelayDuration +
                fadeOutDuration);

  late Animation<int> _charsAnimation;
  late Animation<double> _fadeOutAnimation;

  Duration get totalCharacterAnimationDuration =>
      (speed * text.characters.length);

  List<InlineSpan> charWidgets = [];

  @override
  void initAnimation(AnimationController controller) {
    final fadeOutAnimationRatio =
        fadeOutDuration.inMicroseconds / duration.inMicroseconds;

    final characterAnimationsRatio =
        (speed * text.characters.length).inMicroseconds /
            duration.inMicroseconds;

    _charsAnimation =
        IntTween(begin: 0, end: textCharacters.length).animate(CurvedAnimation(
      parent: controller,
      curve: Interval(0, characterAnimationsRatio, curve: curve),
    ));

    _fadeOutAnimation = Tween(begin: 1.0, end: 0.0).animate(CurvedAnimation(
      parent: controller,
      curve: Interval(1 - fadeOutAnimationRatio, 1.0, curve: curve),
    ));
  }

  @override
  Widget animatedBuilder(BuildContext context, Widget? child) {
    final count = _charsAnimation.value;

    return Stack(
      children: [
        if (child != null)
          Visibility.maintain(
            visible: false,
            child: child,
          ),
        Opacity(
          opacity: _fadeOutAnimation.value,
          child: Text.rich(
            TextSpan(
              children: text.characters.take(count).map((e) {
                return WidgetSpan(
                  child: ScaleAndOpacityAnimation(
                    opacityDuration: characterFadeInDuration,
                    scaleDuration: characterScaleDuration,
                    scaleTween: Tween(begin: scalingFactor, end: 1),
                    child: Text(e, style: textStyle, textAlign: textAlign),
                  ),
                );
              }).toList(),
            ),
          ),
        )
      ],
    );
  }
}

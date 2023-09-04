import 'dart:math';

import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/flutter_sequence_animation.dart';
import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/sequence_animation_tag.dart';
import 'package:flutter/material.dart';
import 'package:vector_math/vector_math_64.dart' show Quaternion, Vector3;

class CharacterTextAnimation extends StatefulWidget {
  final String text;
  final TextStyle? textStyle;

  final Matrix4 initialMatrix4;
  final double initialCharacterOpacity;
  final Curve curve;

  final Duration characterAnimationSpeed;

  final Duration Function(int index)? characterPaintDelay;

  final Curve fadeOutCurve;

  final Duration pauseDuration;
  final Duration fadeOutDuration;

  const CharacterTextAnimation({
    super.key,
    required this.text,
    this.textStyle,
    required this.initialMatrix4,
    this.initialCharacterOpacity = 0.0,
    this.curve = Curves.easeOutExpo,
    this.characterAnimationSpeed = const Duration(milliseconds: 950),
    this.characterPaintDelay,
    this.fadeOutCurve = Curves.easeOutExpo,
    this.fadeOutDuration = const Duration(seconds: 1),
    this.pauseDuration = const Duration(seconds: 1),
  });

  Matrix4 get initialDefaultMatrix => Matrix4.identity()..scale(4.0, 4.0);

  static CharacterTextAnimation variant1(String? text) {
    return CharacterTextAnimation(
      text: text ?? "Variant 1",
      textStyle: const TextStyle(fontSize: 40),
      curve: Curves.easeOutExpo,
      initialMatrix4: Matrix4.identity()..scale(4.0),
    );
  }

  static CharacterTextAnimation variant2(String? text) {
    return CharacterTextAnimation(
      text: text ?? "Variant 2",
      textStyle: const TextStyle(fontSize: 40),
      initialMatrix4: Matrix4.identity(),
      characterAnimationSpeed: const Duration(milliseconds: 2250),
      characterPaintDelay: (index) => Duration(milliseconds: 150 * (index)),
      curve: Curves.easeInOutQuad,
    );
  }

  static CharacterTextAnimation variant3(String? text) {
    return CharacterTextAnimation(
      text: text ?? "Variant 3",
      textStyle: const TextStyle(fontSize: 40),
      initialMatrix4: Matrix4.identity()..scale(0.01),
      curve: Curves.easeInOutQuad,
      characterAnimationSpeed: const Duration(milliseconds: 1300),
      characterPaintDelay: (index) => Duration(milliseconds: index * 45),
    );
  }

  static CharacterTextAnimation variant4(String? text) {
    return CharacterTextAnimation(
      text: text ?? "Variant 4",
      textStyle: const TextStyle(fontSize: 40),
      initialMatrix4: Matrix4.identity()..rotateY(-pi / 2),
      curve: Curves.easeOutExpo,
      characterAnimationSpeed: const Duration(milliseconds: 1300),
      characterPaintDelay: (index) => Duration(milliseconds: index * 45),
    );
  }

  static List<Widget> all(String? text) =>
      [variant1(text), variant2(text), variant3(text), variant4(text)];

  @override
  State<CharacterTextAnimation> createState() => _CharacterTextAnimationState();
}

class _CharacterTextAnimationState extends State<CharacterTextAnimation>
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
      SequenceAnimationTagList<Matrix4>(tagId: "char-scaling");
  final charRotateAnimations =
      SequenceAnimationTagList<Matrix4>(tagId: "char-rotation");
  final charTranslateAnimations =
      SequenceAnimationTagList<Matrix4>(tagId: "char-translate");

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this);
    final animationBuilder = SequenceAnimationBuilder();

    Vector3 translation = Vector3.zero();
    Quaternion rotation = Quaternion.identity();
    Vector3 scale = Vector3.zero();

    widget.initialMatrix4.decompose(translation, rotation, scale);

    final Matrix4Tween rotationMatrixTween = Matrix4Tween(
        begin: Matrix4.identity()..setRotation(rotation.asRotationMatrix()),
        end: Matrix4.identity());

    final Matrix4Tween scaleMatrixTween = Matrix4Tween(
      begin: Matrix4.identity()
        ..setFromTranslationRotationScale(
          Vector3.zero(),
          Quaternion.identity(),
          scale,
        ),
      end: Matrix4.identity(),
    );

    final Matrix4Tween translateMatrixTween = Matrix4Tween(
      begin: Matrix4.identity()..setTranslation(translation),
      end: Matrix4.identity(),
    );

    /// Point where all animations should start
    animationBuilder.addAnimatable(
      animatable: ConstantTween(0.0),
      from: Duration.zero,
      to: Duration.zero,
      tag: sequenceStartPositionTag,
    );

    for (var (index, _) in widget.text.characters.indexed) {
      final opacityAnimationTag = charOpacityAnimations.addTag();
      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: Tween(begin: widget.initialCharacterOpacity, end: 1.0),
        tag: opacityAnimationTag,
        delay: characterDelay(index),
        duration: widget.characterAnimationSpeed,
        curve: widget.curve,
        lastTag: sequenceStartPositionTag,
      );
      final scaleAnimationTag = charScaleAnimations.addTag();
      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: scaleMatrixTween,
        tag: scaleAnimationTag,
        delay: characterDelay(index),
        duration: widget.characterAnimationSpeed,
        curve: widget.curve,
        lastTag: sequenceStartPositionTag,
      );

      final rotationAnimationTag = charRotateAnimations.addTag();
      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: rotationMatrixTween,
        tag: rotationAnimationTag,
        delay: characterDelay(index),
        duration: widget.characterAnimationSpeed,
        curve: widget.curve,
        lastTag: sequenceStartPositionTag,
      );

      final translateAnimationTag = charTranslateAnimations.addTag();
      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: translateMatrixTween,
        tag: translateAnimationTag,
        delay: characterDelay(index),
        duration: widget.characterAnimationSpeed,
        curve: widget.curve,
        lastTag: sequenceStartPositionTag,
      );
    }

    sequenceAnimation = animationBuilder
        .addAnimatableAfterLastOne(
          curve: widget.fadeOutCurve,
          animatable: Tween(begin: 1.0, end: 0.0),
          duration: widget.fadeOutDuration,
          delay: widget.pauseDuration,
          tag: fadeOutAnimationTag,
        )
        .animate(_controller);
    _controller.repeat();
  }

  Duration characterDelay(int index) =>
      widget.characterPaintDelay?.call(index) ??
      Duration(milliseconds: 70 * index);

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
                    child: Transform(
                      transform: charTranslateAnimations
                          .getAnimation(sequenceAnimation, index)
                          .value,
                      child: Transform(
                        transform: charScaleAnimations
                            .getAnimation(sequenceAnimation, index)
                            .value,
                        child: Transform(
                          transform: charRotateAnimations
                              .getAnimation(sequenceAnimation, index)
                              .value,
                          child: Text(value, style: widget.textStyle),
                        ),
                      ),
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

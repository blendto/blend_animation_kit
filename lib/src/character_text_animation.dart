import 'dart:math';

import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/flutter_sequence_animation.dart';
import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/sequence_animation_tag.dart';
import 'package:flutter/material.dart';
import 'package:vector_math/vector_math_64.dart' show Quaternion, Vector3;

enum CharacterTraversalType { forward, reverse }

class CharacterTextAnimation extends StatefulWidget {
  final String text;
  final TextStyle? textStyle;

  final Matrix4 initialMatrix4Transformation;
  final Curve curve;

  final Duration characterAnimationSpeed;
  final Duration? characterExitAnimationSpeed;

  final Duration Function(int index)? characterPaintDelay;
  final Duration Function(int index)? characterExitDelay;

  final Duration pauseDuration;

  /// fadeOut will be used if [exitMatrix4Transformation] is null
  final Matrix4? exitMatrix4Transformation;
  final Curve exitCurve;
  final Duration exitDuration;
  final double exitCharacterOpacity;

  const CharacterTextAnimation({
    super.key,
    required this.text,
    this.textStyle,
    required this.initialMatrix4Transformation,
    this.curve = Curves.easeOutExpo,
    this.characterAnimationSpeed = const Duration(milliseconds: 950),
    this.characterExitAnimationSpeed,
    this.characterPaintDelay,
    this.characterExitDelay,
    this.exitCurve = Curves.easeOutExpo,
    this.exitDuration = const Duration(seconds: 1),
    this.pauseDuration = const Duration(seconds: 1),
    this.exitMatrix4Transformation,
    this.exitCharacterOpacity = 0.0,
  });

  Matrix4 get initialDefaultMatrix => Matrix4.identity()..scale(4.0, 4.0);

  static CharacterTextAnimation variant1(String? text) {
    return CharacterTextAnimation(
      text: text ?? "Variant 1",
      textStyle: const TextStyle(fontSize: 40),
      curve: Curves.easeOutExpo,
      initialMatrix4Transformation: Matrix4.identity()..scale(4.0),
    );
  }

  static CharacterTextAnimation variant2(String? text) {
    return CharacterTextAnimation(
      text: text ?? "Variant 2",
      textStyle: const TextStyle(fontSize: 40),
      initialMatrix4Transformation: Matrix4.identity(),
      characterAnimationSpeed: const Duration(milliseconds: 2250),
      characterPaintDelay: (index) => Duration(milliseconds: 150 * (index + 1)),
      curve: Curves.easeInOutQuad,
    );
  }

  static CharacterTextAnimation variant3(String? text) {
    return CharacterTextAnimation(
      text: text ?? "Variant 3",
      textStyle: const TextStyle(fontSize: 40),
      initialMatrix4Transformation: Matrix4.identity()..scale(0.01),
      curve: Curves.easeInOutQuad,
      characterAnimationSpeed: const Duration(milliseconds: 1300),
      characterPaintDelay: (index) => Duration(milliseconds: index * 45),
    );
  }

  static CharacterTextAnimation variant4(String? text) {
    return CharacterTextAnimation(
      text: text ?? "Variant 4",
      textStyle: const TextStyle(fontSize: 40),
      initialMatrix4Transformation: Matrix4.identity()..rotateY(-pi / 2),
      curve: Curves.easeOutExpo,
      characterAnimationSpeed: const Duration(milliseconds: 1300),
      characterPaintDelay: (index) => Duration(milliseconds: index * 45),
    );
  }

  static CharacterTextAnimation variant5(String? text) {
    return CharacterTextAnimation(
      text: text ?? "Variant 5",
      textStyle: const TextStyle(fontSize: 40),
      initialMatrix4Transformation: Matrix4.identity()..rotateY(-pi / 2),
      curve: Curves.easeOutExpo,
      exitMatrix4Transformation: Matrix4.identity()..rotateX(-pi / 2),
      characterAnimationSpeed: const Duration(milliseconds: 1300),
      exitCharacterOpacity: 1.0,
      characterPaintDelay: (index) => Duration(milliseconds: index * 45),
    );
  }

  static List<Widget> all(String? text) => [
        variant1(text),
        variant2(text),
        variant3(text),
        variant4(text),
        variant5(text),
      ];

  @override
  State<CharacterTextAnimation> createState() => _CharacterTextAnimationState();
}

class _CharacterTextAnimationState extends State<CharacterTextAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final SequenceAnimation sequenceAnimation;

  final sequenceStartPositionTag =
      const SequenceAnimationTag<double>('start-position');
  final charOpacityAnimations =
      SequenceAnimationTagList<double>(tagId: "char-opacity");
  final charScaleAnimations =
      SequenceAnimationTagList<Matrix4>(tagId: "char-scaling");
  final charRotateAnimations =
      SequenceAnimationTagList<Matrix4>(tagId: "char-rotation");
  final charTranslateAnimations =
      SequenceAnimationTagList<Matrix4>(tagId: "char-translate");
  final exitAnimationTag = const SequenceAnimationTag<double>('exit-animation');

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this);

    SequenceAnimationBuilder animationBuilder =
        generateSequenceAnimationBuilder();

    sequenceAnimation = animationBuilder.animate(_controller);
    _controller.repeat();
  }

  SequenceAnimationBuilder generateSequenceAnimationBuilder() {
    final animationBuilder = SequenceAnimationBuilder();

    final Vector3 translation = Vector3.zero();
    final Quaternion rotation = Quaternion.identity();
    final Vector3 scale = Vector3.zero();

    widget.initialMatrix4Transformation.decompose(translation, rotation, scale);

    final identityMatrix4 = Matrix4.identity();
    final Matrix4Tween rotationMatrixTween = Matrix4Tween(
      begin: Matrix4.identity()..setRotation(rotation.asRotationMatrix()),
      end: identityMatrix4,
    );

    final Matrix4Tween scaleMatrixTween = Matrix4Tween(
      begin: Matrix4.identity()..scale(scale),
      end: identityMatrix4,
    );

    final Matrix4Tween translateMatrixTween = Matrix4Tween(
      begin: Matrix4.identity()..setTranslation(translation),
      end: identityMatrix4,
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
        animatable: Tween(begin: 0.0, end: 1.0),
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

    /// Position to start exit animation
    animationBuilder.addAnimatableAfterLastOne(
      animatable: ConstantTween(0.0),
      duration: Duration.zero,
      delay: widget.pauseDuration,
      tag: exitAnimationTag,
    );

    final Vector3 reverseTranslation = Vector3.zero();
    final Quaternion reverseRotation = Quaternion.identity();
    final Vector3 reverseScale = Vector3.zero();
    (widget.exitMatrix4Transformation ?? Matrix4.identity())
        .decompose(reverseTranslation, reverseRotation, reverseScale);

    final Matrix4Tween exitRotationMatrixTween = Matrix4Tween(
      end: Matrix4.identity()..setRotation(reverseRotation.asRotationMatrix()),
      begin: identityMatrix4,
    );

    final Matrix4Tween exitScaleMatrixTween = Matrix4Tween(
      end: Matrix4.identity()..scale(reverseScale),
      begin: identityMatrix4,
    );

    final Matrix4Tween exitTranslateMatrixTween = Matrix4Tween(
      end: Matrix4.identity()..setTranslation(reverseTranslation),
      begin: identityMatrix4,
    );

    for (var (index, _) in widget.text.characters.indexed) {
      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: Tween(begin: 1.0, end: widget.exitCharacterOpacity),
        tag: charOpacityAnimations.getTag(index),
        delay: characterExitDelay(index),
        duration: widget.exitDuration,
        curve: widget.exitCurve,
        lastTag: exitAnimationTag,
      );

      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: exitScaleMatrixTween,
        tag: charScaleAnimations.getTag(index),
        delay: characterDelay(index),
        duration: widget.exitDuration,
        curve: widget.curve,
        lastTag: exitAnimationTag,
      );

      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: exitRotationMatrixTween,
        tag: charRotateAnimations.getTag(index),
        delay: characterDelay(index),
        duration: widget.exitDuration,
        curve: widget.curve,
        lastTag: exitAnimationTag,
      );

      final translateAnimationTag = charTranslateAnimations.addTag();
      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: exitTranslateMatrixTween,
        tag: translateAnimationTag,
        delay: characterDelay(index),
        duration: widget.exitDuration,
        curve: widget.curve,
        lastTag: exitAnimationTag,
      );
    }

    /// Revert to default
    for (var (index, _) in widget.text.characters.indexed) {
      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: ConstantTween(0.0),
        tag: charOpacityAnimations.getTag(index),
        delay: characterExitDelay(index),
        duration: Duration.zero,
        curve: widget.exitCurve,
        lastTag: charOpacityAnimations.getTag(index),
      );

      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: ConstantTween(Matrix4.identity()),
        tag: charScaleAnimations.getTag(index),
        delay: Duration.zero,
        duration: Duration.zero,
        curve: widget.curve,
        lastTag: charScaleAnimations.getTag(index),
      );

      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: ConstantTween(Matrix4.identity()),
        tag: charRotateAnimations.getTag(index),
        delay: Duration.zero,
        duration: Duration.zero,
        curve: widget.curve,
        lastTag: charRotateAnimations.getTag(index),
      );

      final translateAnimationTag = charTranslateAnimations.getTag(index);
      animationBuilder.addAnimatableAfterLastOneWithTag(
        animatable: ConstantTween(Matrix4.identity()),
        tag: translateAnimationTag,
        delay: Duration.zero,
        duration: Duration.zero,
        curve: widget.curve,
        lastTag: translateAnimationTag,
      );
    }

    return animationBuilder;
  }

  Duration characterDelay(int index) =>
      widget.characterPaintDelay?.call(index) ??
      Duration(milliseconds: 70 * index);

  Duration characterExitDelay(int index) =>
      widget.characterExitDelay?.call(index) ?? Duration.zero;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _generateCharacterAnimation(String character, int index) {
    return Opacity(
      opacity:
          charOpacityAnimations.getAnimation(sequenceAnimation, index).value,
      child: Transform(
        alignment: Alignment.center,
        transform: charTranslateAnimations
            .getAnimation(sequenceAnimation, index)
            .value,
        child: Transform(
          alignment: Alignment.center,
          transform:
              charRotateAnimations.getAnimation(sequenceAnimation, index).value,
          child: Transform(
            alignment: Alignment.center,
            transform: charScaleAnimations
                .getAnimation(sequenceAnimation, index)
                .value,
            child: Text(character, style: widget.textStyle),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      builder: (context, child) {
        return Text.rich(
          TextSpan(
            children: widget.text.characters.indexed.map((char) {
              final index = char.$1;
              final value = char.$2;
              return WidgetSpan(
                child: _generateCharacterAnimation(value, index),
              );
            }).toList(),
          ),
        );
      },
      animation: _controller,
    );
  }
}

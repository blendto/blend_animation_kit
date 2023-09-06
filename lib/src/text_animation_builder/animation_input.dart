import 'package:custom_text_animations/src/text_animation_builder/animation_property.dart';
import 'package:flutter/material.dart';

abstract class AnimationInput {
  String get text;

  TextStyle? get textStyle;

  Iterable<String> get groups;

  List<AnimationProperty> get animationProperties;
}

class CharacterAnimationInput extends AnimationInput {
  @override
  final String text;
  @override
  final TextStyle? textStyle;

  @override
  Iterable<String> get groups => text.characters;

  @override
  late final List<AnimationProperty> animationProperties;

  CharacterAnimationInput({
    required this.text,
    this.textStyle,
  }) {
    animationProperties =
        List.generate(groups.length, (index) => AnimationProperty());
  }
}

class WordAnimationInput extends AnimationInput {
  @override
  late final Iterable<String> groups;

  @override
  late final List<AnimationProperty> animationProperties;

  @override
  final String text;

  @override
  final TextStyle? textStyle;

  WordAnimationInput({
    required this.text,
    this.textStyle,
  }) {
    final re = RegExp(r"\w+|\s+|[^\s\w]+");
    groups = re.allMatches(text).map((m) => m.group(0) ?? '');
    animationProperties = List.generate(
      groups.length,
      (index) => AnimationProperty(),
    );
  }
}

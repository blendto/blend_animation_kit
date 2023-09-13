import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:flutter/material.dart';

abstract class AnimationInput {
  String get text;

  Iterable<String> get groups;

  List<AnimationProperty> get animationProperties;
}

class CharacterAnimationInput extends AnimationInput {
  @override
  final String text;

  @override
  final Iterable<String> groups;

  @override
  late final List<AnimationProperty> animationProperties;

  CharacterAnimationInput({
    required this.text,
  }) : groups = text.characters {
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

  WordAnimationInput({
    required this.text,
  }) {
    final re = RegExp(r"\w+|\s+|[^\s\w]+");
    groups = re.allMatches(text).map((m) => m.group(0) ?? '');
    animationProperties = List.generate(
      groups.length,
      (index) => AnimationProperty(),
    );
  }
}

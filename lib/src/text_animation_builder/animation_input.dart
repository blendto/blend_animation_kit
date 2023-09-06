import 'package:custom_text_animations/src/text_animation_builder/animation_property.dart';
import 'package:flutter/material.dart';

abstract class AnimationInput {
  String get text;

  TextStyle? get textStyle;

  List<SceneItem> get sceneItems;

  Duration get begin;

  Iterable<String> get groups;

  List<AnimationProperty> get animationProperties;

  AnimationInput copyWith({List<SceneItem>? sceneItems, Duration? begin});
}

class CharacterAnimationInput extends AnimationInput {
  @override
  final String text;
  @override
  final TextStyle? textStyle;

  @override
  final List<SceneItem> sceneItems;

  @override
  final Duration begin;

  @override
  Iterable<String> get groups => text.characters;

  @override
  late final List<AnimationProperty> animationProperties;

  CharacterAnimationInput._({
    required this.text,
    required this.textStyle,
    required this.sceneItems,
    required this.begin,
    required this.animationProperties,
  });

  CharacterAnimationInput({
    required this.text,
    this.textStyle,
  })  : sceneItems = const [],
        begin = Duration.zero {
    animationProperties =
        List.generate(groups.length, (index) => AnimationProperty());
  }

  @override
  CharacterAnimationInput copyWith(
      {List<SceneItem>? sceneItems, Duration? begin}) {
    return CharacterAnimationInput._(
      animationProperties: animationProperties,
      sceneItems: sceneItems ?? this.sceneItems,
      text: text,
      textStyle: textStyle,
      begin: begin ?? this.begin,
    );
  }
}

class WordAnimationInput extends AnimationInput {
  @override
  late final Iterable<String> groups;

  @override
  late final List<AnimationProperty> animationProperties;

  @override
  final Duration begin;

  @override
  final List<SceneItem> sceneItems;

  @override
  final String text;

  @override
  final TextStyle? textStyle;

  WordAnimationInput._({
    required this.text,
    required this.textStyle,
    required this.begin,
    required this.sceneItems,
    required this.animationProperties,
  });

  WordAnimationInput({
    required this.text,
    this.textStyle,
  })  : sceneItems = const [],
        begin = Duration.zero {
    final re = RegExp(r"\w+|\s+|[^\s\w]+");
    groups = re.allMatches(text).map((m) => m.group(0) ?? '');
    animationProperties = List.generate(
      groups.length,
      (index) => AnimationProperty(),
    );
  }

  @override
  WordAnimationInput copyWith({List<SceneItem>? sceneItems, Duration? begin}) {
    return WordAnimationInput._(
      begin: begin ?? this.begin,
      sceneItems: sceneItems ?? this.sceneItems,
      animationProperties: animationProperties,
      text: text,
      textStyle: textStyle,
    );
  }
}

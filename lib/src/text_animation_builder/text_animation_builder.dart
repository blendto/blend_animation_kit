import 'package:custom_text_animations/src/text_animation_builder/animation_properties.dart';
import 'package:custom_text_animations/src/text_animation_builder/matrix4_alignment_tween.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/animation_builder/loop_animation_builder.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

enum BreakType { character, word }

@immutable
class TextAnimationBuilder {
  final String text;
  final TextStyle? textStyle;

  late final Iterable<SceneItem> sceneItems;

  late final Duration _begin;

  /// Waits for previous animations
  TextAnimationBuilder wait() {
    final begin = tween.duration;
    return copyWith(begin: begin);
  }

  /// Adds delay for next animations for a [duration]
  TextAnimationBuilder delay(Duration delay) {
    final newBegin = delay + tween.duration;
    return copyWith(
      begin: newBegin,
      sceneItems: List.from(sceneItems)
        ..add(PauseScene(duration: delay, from: tween.duration)),
    );
  }

  late final MovieTween tween = _generateTween();

  Iterable<String> get _groups => animationInput.groups;

  Iterable<OpacityProperty> get opacityProperties =>
      animationInput.opacityProperties;

  Iterable<TransformationProperty> get transformProperties =>
      animationInput.transformProperties;

  final CharacterAnimationInput animationInput;

  TextAnimationBuilder(this.animationInput)
      : text = animationInput.text,
        textStyle = animationInput.textStyle,
        _begin = animationInput.begin,
        sceneItems = animationInput.sceneItems;

  TextAnimationBuilder copyWith(
      {Iterable<SceneItem>? sceneItems, Duration? begin}) {
    return TextAnimationBuilder(animationInput.copyWith(
      sceneItems: sceneItems,
      begin: begin,
    ));
  }

  MovieTween _generateTween() {
    MovieTween movieTween = MovieTween();
    for (var element in sceneItems) {
      element.attachToScene(movieTween);
    }
    return movieTween;
  }

  TextAnimationBuilder transform({
    required Matrix4 initialMatrix,
    required Matrix4 finalMatrix,
    required Duration speed,
    required Duration stepInterval,
    required Curve curve,
    Alignment transformAlignment = Alignment.center,
  }) {
    final newSceneItems = List.of(sceneItems);
    for (var (index, _) in _groups.indexed) {
      final property = transformProperties.elementAt(index);
      newSceneItems.add(ScenePropertyItem(
        property: property,
        tween: Matrix4WithAlignmentTween(
          begin: initialMatrix,
          end: finalMatrix,
          transformAlignment: transformAlignment,
        ),
        curve: curve,
        from: _begin + (stepInterval * index),
        duration: speed,
      ));
    }

    return copyWith(sceneItems: newSceneItems);
  }

  TextAnimationBuilder opacity({
    required double initialOpacity,
    required Duration speed,
    required Duration stepInterval,
    required Curve curve,
    required double finalOpacity,
  }) {
    final newSceneItems = List.of(sceneItems);
    for (var (index, _) in _groups.indexed) {
      final property = opacityProperties.elementAt(index);
      newSceneItems.add(ScenePropertyItem(
        property: property,
        tween: Tween<double>(begin: initialOpacity, end: finalOpacity),
        curve: curve,
        from: _begin + (stepInterval * index),
        duration: speed,
      ));
    }
    return copyWith(sceneItems: newSceneItems);
  }

  Widget generateWidget() {
    return LoopAnimationBuilder(
      tween: tween,
      builder: (context, movie, _) {
        return Text.rich(
          TextSpan(
            children: _groups.indexed.map((char) {
              final index = char.$1;
              final value = char.$2;

              return WidgetSpan(
                child: Opacity(
                  opacity: opacityProperties
                      .elementAt(index)
                      .fromOrDefault(movie)
                      .clamp(0, 1),
                  child: Transform(
                    alignment: transformProperties
                        .elementAt(index)
                        .fromOrDefault(movie)
                        .transformAlignment,
                    transform: transformProperties
                        .elementAt(index)
                        .fromOrDefault(movie)
                        .matrix,
                    child: Text(value, style: textStyle),
                  ),
                ),
              );
            }).toList(),
          ),
        );
      },
      duration: tween.duration,
    );
  }
}

class CharacterAnimationInput {
  final String text;
  final TextStyle? textStyle;

  final Iterable<SceneItem> sceneItems;

  final Duration begin;

  Iterable<String> get groups => text.characters;

  late final Iterable<OpacityProperty> opacityProperties;

  late final Iterable<TransformationProperty> transformProperties;

  CharacterAnimationInput({
    required this.text,
    this.textStyle,
    this.sceneItems = const [],
    this.begin = Duration.zero,
    Iterable<OpacityProperty>? opacityProperties,
    Iterable<TransformationProperty>? transformProperties,
  }) {
    this.opacityProperties = opacityProperties ??
        List.generate(groups.length, (index) => OpacityProperty());
    this.transformProperties = transformProperties ??
        List.generate(groups.length, (index) => TransformationProperty());
  }

  CharacterAnimationInput copyWith(
      {Iterable<SceneItem>? sceneItems, Duration? begin}) {
    return CharacterAnimationInput(
      opacityProperties: opacityProperties,
      transformProperties: transformProperties,
      sceneItems: sceneItems ?? this.sceneItems,
      text: text,
      textStyle: textStyle,
      begin: begin ?? this.begin,
    );
  }
}

class WordAnimationInput extends CharacterAnimationInput {
  @override
  Iterable<String> get groups {
    final words = text.split("\\s+").toList();
    for (var i = 1; i < words.length - 1; i++) {
      words.add(" ");
    }
    return words;
  }

  WordAnimationInput(
      {required super.text,
      super.textStyle,
      super.sceneItems = const [],
      super.begin = Duration.zero,
      super.opacityProperties,
      super.transformProperties})
      : super();

  @override
  WordAnimationInput copyWith(
      {Iterable<SceneItem>? sceneItems, Duration? begin}) {
    return WordAnimationInput(
      opacityProperties: opacityProperties,
      transformProperties: transformProperties,
      sceneItems: sceneItems ?? this.sceneItems,
      text: text,
      textStyle: textStyle,
      begin: begin ?? this.begin,
    );
  }
}

import 'package:custom_text_animations/src/text_animation_builder/animation_properties.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/animation_builder/loop_animation_builder.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

enum BreakType { character, word }

@immutable
class TextAnimationBuilder {
  final String text;
  final TextStyle? textStyle;

  late final Iterable<OpacityProperty> _characterOpacityProperties;

  late final Iterable<TransformationProperty> _characterTransformProperties;

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

  late final Iterable<String> _groups;

  TextAnimationBuilder(
      {required this.text, this.textStyle, required BreakType breakType}) {
    _begin = Duration.zero;
    sceneItems = [];
    switch (breakType) {
      case BreakType.character:
        _groups = text.characters;
        break;
      case BreakType.word:
        final words = text.split("\\s+").toList();
        for (var i = 1; i < words.length - 1; i++) {
          words.add(" ");
        }
        _groups = words;
      default:
        throw UnimplementedError("Unimplemented breakType");
    }
    _characterOpacityProperties =
        List.generate(_groups.length, (index) => OpacityProperty());
    _characterTransformProperties =
        List.generate(_groups.length, (index) => TransformationProperty());
  }

  TextAnimationBuilder._custom({
    required Iterable<OpacityProperty> opacityProperties,
    required Iterable<TransformationProperty> transformProperties,
    this.textStyle,
    required this.text,
    required this.sceneItems,
    required Duration begin,
    required Iterable<String> groups,
  })  : _groups = groups,
        _characterTransformProperties = transformProperties,
        _characterOpacityProperties = opacityProperties,
        _begin = begin;

  TextAnimationBuilder copyWith(
      {Iterable<SceneItem>? sceneItems, Duration? begin}) {
    return TextAnimationBuilder._custom(
      opacityProperties: _characterOpacityProperties,
      transformProperties: _characterTransformProperties,
      sceneItems: sceneItems ?? this.sceneItems,
      text: text,
      textStyle: textStyle,
      begin: begin ?? _begin,
      groups: _groups,
    );
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
  }) {
    final newSceneItems = List.of(sceneItems);
    for (var (index, _) in _groups.indexed) {
      final property = _characterTransformProperties.elementAt(index);
      newSceneItems.add(ScenePropertyItem(
        property: property,
        tween: Matrix4Tween(begin: initialMatrix, end: finalMatrix),
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
      final property = _characterOpacityProperties.elementAt(index);
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

  TextAnimationBuilder opacityAndTransform({
    required double initialOpacity,
    required double finalOpacity,
    required Matrix4 initialMatrix,
    required Matrix4 finalMatrix,
    required Duration speed,
    required Duration stepInterval,
    required Curve curve,
  }) {
    return opacity(
      initialOpacity: initialOpacity,
      speed: speed,
      stepInterval: stepInterval,
      curve: curve,
      finalOpacity: finalOpacity,
    ).transform(
      initialMatrix: initialMatrix,
      finalMatrix: finalMatrix,
      speed: speed,
      stepInterval: stepInterval,
      curve: curve,
    );
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
                  opacity: _characterOpacityProperties
                      .elementAt(index)
                      .fromOrDefault(movie),
                  child: Transform(
                    transform: _characterTransformProperties
                        .elementAt(index)
                        .fromOrDefault(movie),
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

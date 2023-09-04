import 'package:custom_text_animations/src/text_animation_builder/animation_properties.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/animation_builder/loop_animation_builder.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

typedef CharacterDelayCallback = Duration Function(int);

@immutable
class CharacterAnimationBuilder {
  final String text;
  final TextStyle? textStyle;

  final Iterable<OpacityProperty> _characterOpacityProperties;

  final Iterable<TransformationProperty> _characterTransformProperties;

  final Iterable<SceneItem> sceneItems;

  final Duration _begin;

  /// Waits for previous animations
  CharacterAnimationBuilder wait() {
    final begin = tween.duration;
    return copyWith(begin: begin);
  }

  /// Adds delay for next animations for a [duration]
  CharacterAnimationBuilder delay(Duration delay) {
    final begin = _begin + tween.duration;

    return copyWith(
      begin: begin,
      sceneItems: List.from(sceneItems)
        ..add(PauseScene(duration: delay, begin: begin)),
    );
  }

  late final MovieTween tween = _generateTween();

  CharacterAnimationBuilder({required this.text, this.textStyle})
      : _characterOpacityProperties = List.generate(
          text.characters.length,
          (index) => OpacityProperty(),
        ).toList(),
        _characterTransformProperties = List.generate(
          text.characters.length,
          (index) => TransformationProperty(),
        ).toList(),
        _begin = Duration.zero,
        sceneItems = [];

  CharacterAnimationBuilder._custom({
    required Iterable<OpacityProperty> opacityProperties,
    required Iterable<TransformationProperty> transformProperties,
    this.textStyle,
    required this.text,
    required this.sceneItems,
    required Duration begin,
  })  : _characterTransformProperties = transformProperties,
        _characterOpacityProperties = opacityProperties,
        _begin = begin;

  CharacterAnimationBuilder copyWith(
      {Iterable<SceneItem>? sceneItems, Duration? begin}) {
    return CharacterAnimationBuilder._custom(
      opacityProperties: _characterOpacityProperties,
      transformProperties: _characterTransformProperties,
      text: text,
      textStyle: textStyle,
      sceneItems: sceneItems ?? this.sceneItems,
      begin: begin ?? _begin,
    );
  }

  MovieTween _generateTween() {
    MovieTween movieTween = MovieTween();
    for (var element in sceneItems) {
      element.attachToScene(movieTween);
    }
    return movieTween;
  }

  CharacterAnimationBuilder transform({
    required Matrix4 initialMatrix,
    required Duration characterAnimationSpeed,
    required CharacterDelayCallback characterPaintDelay,
    required Curve curve,
    required Matrix4 finalMatrix,
  }) {
    final newSceneItems = List.of(sceneItems);
    for (var (index, _) in text.characters.indexed) {
      final property = _characterTransformProperties.elementAt(index);
      newSceneItems.add(ScenePropertyItem(
        property: property,
        tween: Matrix4Tween(begin: initialMatrix, end: finalMatrix),
        curve: curve,
        begin: _begin + characterPaintDelay(index),
        duration: characterAnimationSpeed,
      ));
    }

    return copyWith(sceneItems: newSceneItems);
  }

  CharacterAnimationBuilder opacity({
    required double initialOpacity,
    required Duration characterAnimationSpeed,
    required CharacterDelayCallback characterDelay,
    required Curve curve,
    required double finalOpacity,
  }) {
    final newSceneItems = List.of(sceneItems);
    for (var (index, _) in text.characters.indexed) {
      final property = _characterOpacityProperties.elementAt(index);
      newSceneItems.add(ScenePropertyItem(
        property: property,
        tween: Tween<double>(begin: initialOpacity, end: finalOpacity),
        curve: curve,
        begin: _begin + characterDelay(index),
        duration: characterAnimationSpeed,
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
            children: text.characters.indexed.map((char) {
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

abstract class SceneItem {
  Duration get duration;

  Duration get begin;

  void attachToScene(MovieTween tween);
}

class ScenePropertyItem implements SceneItem {
  final CustomMovieTweenProperty property;
  final Animatable<dynamic> tween;
  final Curve curve;
  @override
  final Duration begin;

  @override
  final Duration duration;

  const ScenePropertyItem({
    required this.property,
    required this.tween,
    required this.curve,
    required this.begin,
    required this.duration,
  });

  @override
  void attachToScene(MovieTween movieTween) {
    movieTween.tween(
      property,
      tween,
      curve: curve,
      begin: begin,
      duration: duration,
    );
  }
}

class PauseScene implements SceneItem {
  @override
  final Duration duration;
  @override
  final Duration begin;

  const PauseScene({required this.duration, required this.begin});

  @override
  void attachToScene(MovieTween movieTween) {
    movieTween.scene(
      begin: begin,
      duration: duration,
    );
  }
}

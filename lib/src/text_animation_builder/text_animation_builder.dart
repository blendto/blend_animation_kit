import 'package:custom_text_animations/src/text_animation_builder/animation_input.dart';
import 'package:custom_text_animations/src/text_animation_builder/animation_property.dart';
import 'package:custom_text_animations/src/text_animation_builder/matrix4_alignment_tween.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/animation_builder/loop_animation_builder.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

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

  List<AnimationProperty> get animationProperties =>
      animationInput.animationProperties;

  final CharacterAnimationInput animationInput;

  TextAnimationBuilder(this.animationInput)
      : text = animationInput.text,
        textStyle = animationInput.textStyle,
        _begin = animationInput.begin,
        sceneItems = animationInput.sceneItems;

  TextAnimationBuilder copyWith(
      {List<SceneItem>? sceneItems, Duration? begin}) {
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
      final property = animationProperties.elementAt(index).transformation;
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
      final property = animationProperties.elementAt(index).opacity;
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

              final animationProperty = animationProperties.elementAt(index);
              return WidgetSpan(
                child: Opacity(
                  opacity: animationProperty.opacity
                      .fromOrDefault(movie)
                      .clamp(0, 1),
                  child: Transform(
                    alignment: animationProperty.transformation
                        .fromOrDefault(movie)
                        .transformAlignment,
                    transform: animationProperty.transformation
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

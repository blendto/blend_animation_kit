import 'package:blend_animation_kit/src/animation_input.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/extensions.dart';
import 'package:blend_animation_kit/src/matrix4_alignment_tween.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/animation_builder/loop_animation_builder.dart';
import 'package:simple_animations/movie_tween/movie_tween.dart';

@immutable
class TextAnimationBuilder {
  late final Iterable<SceneItem> sceneItems;

  late final Duration begin;

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

  final AnimationInput animationInput;

  TextAnimationBuilder(this.animationInput)
      : begin = Duration.zero,
        sceneItems = [];

  TextAnimationBuilder._({
    required this.animationInput,
    required this.sceneItems,
    required this.begin,
  });

  TextAnimationBuilder copyWith(
      {List<SceneItem>? sceneItems, Duration? begin}) {
    return TextAnimationBuilder._(
      animationInput: animationInput,
      sceneItems: sceneItems ?? this.sceneItems,
      begin: begin ?? this.begin,
    );
  }

  MovieTween _generateTween() {
    MovieTween movieTween = MovieTween();
    for (final element in sceneItems) {
      element.attachToScene(movieTween);
    }
    return movieTween;
  }

  TextAnimationBuilder transform({
    required Matrix4 initialMatrix,
    required Matrix4 finalMatrix,
    required Duration stepDuration,
    required Duration interStepDelay,
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
        from: begin + (interStepDelay * index),
        duration: stepDuration,
      ));
    }

    return copyWith(sceneItems: newSceneItems);
  }

  TextAnimationBuilder opacity({
    required double initialOpacity,
    required Duration stepDuration,
    required Duration interStepDelay,
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
        from: begin + (interStepDelay * index),
        duration: stepDuration,
      ));
    }
    return copyWith(sceneItems: newSceneItems);
  }

  List<List<Widget>> getWidgets(Movie movie) {
    final groups = _groups.indexed;
    final List<List<Widget>> spans = [];
    final innerSpan = <Widget>[];
    for (final text in groups) {
      final animationProperty = animationProperties.elementAt(text.$1);
      innerSpan.add(Opacity(
        opacity: animationProperty.opacity.fromOrDefault(movie).clamp(0, 1),
        child: Transform(
          alignment: animationProperty.transformation
              .fromOrDefault(movie)
              .transformAlignment,
          transform:
              animationProperty.transformation.fromOrDefault(movie).matrix,
          child: Text(
            text.$2,
            textAlign: TextAlign.center,
            style: animationInput.textStyle,
          ),
        ),
      ));
      if (text.$2 == " ") {
        spans.add(innerSpan.toList());
        innerSpan.clear();
      }
    }
    if (innerSpan.isNotEmpty) {
      spans.add(innerSpan);
    }
    return spans;
  }

  Widget generateWidget({TextAlign textAlign = TextAlign.start}) {
    return LoopAnimationBuilder(
      tween: tween,
      builder: (context, movie, _) {
        return Wrap(
          alignment: textAlign.toWrapAlignment(),
          direction: Axis.horizontal,
          children: getWidgets(movie)
              .map((e) => Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: e,
                  ))
              .toList(),
        );
      },
      duration: tween.duration,
    );
  }
}

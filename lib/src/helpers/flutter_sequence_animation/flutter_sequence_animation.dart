import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/interval_animation.dart';
import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/sequence_animation_tag.dart';
import 'package:flutter/material.dart';

// Reference: https://github.com/sroddy/flutter_sequence_animation/tree/feature/type_safety

class AnimationInformation<T> {
  AnimationInformation({
    required this.animatable,
    required this.from,
    required this.to,
    required this.curve,
    required this.tag,
  });

  final Animatable<T> animatable;
  final Duration from;
  final Duration to;
  final Curve curve;
  final SequenceAnimationTag<T> tag;

  IntervalAnimatable<T> createIntervalAnimatable({
    required Animatable<T> animatable,
    required Animatable<T> defaultAnimatable,
    required double begin,
    required double end,
  }) =>
      IntervalAnimatable<T>(
        animatable: animatable,
        defaultAnimatable: defaultAnimatable,
        begin: begin,
        end: end,
      );
}

class SequenceAnimationBuilder {
  final List<AnimationInformation> _animations = [];

  // Returns the duration of the current animation chain
  Duration getCurrentDuration() {
    return Duration(microseconds: _currentLengthInMicroSeconds());
  }

  /// Convenient wrapper to add an animatable after the last one with a specific tag finished is finished
  ///
  /// The tags must be comparable! Strings, enums work, when using objects, be sure to override the == method
  ///
  /// [delay] is the delay to when this animation should start after the last one finishes.
  /// For example:
  ///
  ///```dart
  ///     SequenceAnimation sequenceAnimation = new SequenceAnimationBuilder()
  ///         .addAnimatable(
  ///           animatable: new ColorTween(begin: Colors.red, end: Colors.yellow),
  ///           from: const Duration(seconds: 0),
  ///           to: const Duration(seconds: 2),
  ///           tag: "color",
  ///         ).addAnimatableAfterLastOneWithTag(
  ///            animatable: new ColorTween(begin: Colors.red, end: Colors.yellow),
  ///            delay: const Duration(seconds: 1),
  ///            duration: const Duration(seconds: 1),
  ///            tag: "animation",
  ///            lastTag: "color",
  ///         ).animate(controller);
  ///
  /// ```
  ///
  /// The animation with tag "animation" will start at second 3 and run until second 4.
  ///
  SequenceAnimationBuilder
      addAnimatableAfterLastOneWithTag<T, A extends Animatable<T>>({
    required SequenceAnimationTag lastTag,
    required A animatable,
    Duration delay = Duration.zero,
    required Duration duration,
    Curve curve = Curves.linear,
    required SequenceAnimationTag<T> tag,
  }) {
    assert(_animations.isNotEmpty,
        "Can not add animatable after last one if there is no animatable yet");
    var start = _animations
        .cast<AnimationInformation?>()
        .lastWhere((it) => it?.tag == lastTag, orElse: () => null)
        ?.to;
    assert(start != null,
        "Animation with tag $lastTag can not be found before $tag");
    start!;
    return addAnimatable(
        animatable: animatable,
        from: start + delay,
        to: start + delay + duration,
        tag: tag,
        curve: curve);
  }

  /// Convenient wrapper to add an animatable after the last one is finished
  ///
  /// [delay] is the delay to when this animation should start after the last one finishes.
  /// For example:
  ///
  ///```dart
  ///     SequenceAnimation sequenceAnimation = new SequenceAnimationBuilder()
  ///         .addAnimatable(
  ///           animatable: new ColorTween(begin: Colors.red, end: Colors.yellow),
  ///           from: const Duration(seconds: 0),
  ///           to: const Duration(seconds: 2),
  ///           tag: "color",
  ///         ).addAnimatableAfterLastOne(
  ///            animatable: new ColorTween(begin: Colors.red, end: Colors.yellow),
  ///            delay: const Duration(seconds: 1),
  ///            duration: const Duration(seconds: 1),
  ///            tag: "animation",
  ///         ).animate(controller);
  ///
  /// ```
  ///
  /// The animation with tag "animation" will start at second 3 and run until second 4.
  ///
  SequenceAnimationBuilder
      addAnimatableAfterLastOne<T, A extends Animatable<T>>({
    required A animatable,
    Duration delay = Duration.zero,
    required Duration duration,
    Curve curve = Curves.linear,
    required SequenceAnimationTag<T> tag,
  }) {
    assert(_animations.isNotEmpty,
        "Can not add animatable after last one if there is no animatable yet");
    var start = _animations.last.to;
    return addAnimatable(
        animatable: animatable,
        from: start + delay,
        to: start + delay + duration,
        tag: tag,
        curve: curve);
  }

  /// Convenient wrapper around to specify an animatable using a duration instead of end point
  ///
  /// Instead of specifying from and to, you specify start and duration
  SequenceAnimationBuilder
      addAnimatableUsingDuration<T, A extends Animatable<T>>({
    required A animatable,
    required Duration start,
    required Duration duration,
    Curve curve = Curves.linear,
    required SequenceAnimationTag<T> tag,
  }) {
    return addAnimatable(
        animatable: animatable,
        from: start,
        to: start + duration,
        tag: tag,
        curve: curve);
  }

  /// Adds an [Animatable] to the sequence, in the most cases this would be a [Tween].
  /// The from and to [Duration] specify points in time where the animation takes place.
  /// You can also specify a [Curve] for the [Animatable].
  ///
  /// [Animatable]s which animate on the same tag are not allowed to overlap and they also need to be add in the same order they are played.
  /// These restrictions only apply to [Animatable]s operating on the same tag.
  ///
  ///
  /// ## Sample code
  ///
  /// ```dart
  ///     SequenceAnimation sequenceAnimation = new SequenceAnimationBuilder()
  ///         .addAnimatable(
  ///           animatable: new ColorTween(begin: Colors.red, end: Colors.yellow),
  ///           from: const Duration(seconds: 0),
  ///           to: const Duration(seconds: 2),
  ///           tag: "color",
  ///         )
  ///         .animate(controller);
  /// ```
  ///
  SequenceAnimationBuilder addAnimatable<T, A extends Animatable<T>>({
    required A animatable,
    required Duration from,
    required Duration to,
    Curve curve = Curves.linear,
    required SequenceAnimationTag<T> tag,
  }) {
    assert(T.toString() != 'Object');
    assert(to >= from);
    _animations.add(AnimationInformation<T>(
        animatable: animatable, from: from, to: to, curve: curve, tag: tag));
    return this;
  }

  int _currentLengthInMicroSeconds() {
    int longestTimeMicro = 0;
    for (var info in _animations) {
      int micro = info.to.inMicroseconds;
      if (micro > longestTimeMicro) {
        longestTimeMicro = micro;
      }
    }
    return longestTimeMicro;
  }

  /// The controllers duration is going to be overwritten by this class, you should not specify it on your own
  SequenceAnimation animate(AnimationController controller) {
    int longestTimeMicro = _currentLengthInMicroSeconds();
    // Sets the duration of the controller
    controller.duration = Duration(microseconds: longestTimeMicro);

    final IntervalAnimationBuilder intervalAnimationBuilder =
        IntervalAnimationBuilder(animationController: controller);

    for (var info in _animations) {
      intervalAnimationBuilder.add(info);
    }

    return SequenceAnimation._internal(
      intervalAnimationBuilder.getAnimations(),
    );
  }
}

class SequenceAnimation {
  final Map<SequenceAnimationTag, Animation> _animations;

  /// Use the [SequenceAnimationBuilder] to construct this class.
  SequenceAnimation._internal(this._animations);

  /// Returns the animation with a given tag, this animation is tied to the controller.
  Animation<T> get<T>(SequenceAnimationTag<T> tag) {
    assert(_animations.containsKey(tag),
        "There was no animatable with the tag: $tag");

    return _animations[tag]! as Animation<T>;
  }
}

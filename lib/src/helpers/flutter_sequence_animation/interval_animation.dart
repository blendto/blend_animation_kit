import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/flutter_sequence_animation.dart';
import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/sequence_animation_tag.dart';
import 'package:flutter/material.dart';

/// Evaluates [animatable] if the animation is in the time-frame of [begin] (inclusive) and [end] (inclusive),
/// if not it evaluates the [defaultAnimatable]
class IntervalAnimatable<T> extends Animatable<T> {
  const IntervalAnimatable({
    required this.animatable,
    required this.defaultAnimatable,
    required this.begin,
    required this.end,
  });

  final Animatable<T> animatable;
  final Animatable<T> defaultAnimatable;

  /// The relative begin to of [animatable]
  /// If your [AnimationController] is running from 0->1, this needs to be a value between those two
  final double begin;

  /// The relative end to of [animatable]
  /// If your [AnimationController] is running from 0->1, this needs to be a value between those two
  final double end;

  @override
  T transform(double t) {
    if (t >= begin && t <= end) {
      return animatable.transform(t);
    } else {
      return defaultAnimatable.transform(t);
    }
  }
}

extension Chain<T> on Animatable<T> {
  /// Chains an [Animatable] with a [CurveTween] and the given [Interval].
  /// Basically, the animation is being constrained to the given interval
  Animatable<T> chainCurve(Interval interval) {
    return chain(CurveTween(curve: interval));
  }
}

class IntervalAnimationBuilder {
  final Map<SequenceAnimationTag, Animatable> animatables = {};

  final Map<SequenceAnimationTag, double> begins = {};
  final Map<SequenceAnimationTag, double> ends = {};

  final AnimationController animationController;

  IntervalAnimationBuilder({required this.animationController});

  void add(AnimationInformation info) {
    assert(animationController.duration != null,
        "animationController should have duration");
    final animationDurationMicro = animationController.duration!.inMicroseconds;

    assert(info.to.inMicroseconds <= animationDurationMicro);

    double begin = info.from.inMicroseconds / animationDurationMicro;
    double end = info.to.inMicroseconds / animationDurationMicro;

    Interval intervalCurve = Interval(begin, end, curve: info.curve);
    if (animatables[info.tag] == null) {
      animatables[info.tag] = info.animatable.chainCurve(intervalCurve);
      begins[info.tag] = begin;
      ends[info.tag] = end;
    } else {
      assert(
        ends[info.tag]! <= begin,
        "When animating the same property you need to: \n"
        "a) Have them not overlap \n"
        "b) Add them in an ordered fashion\n"
        "Animation with tag ${info.tag} ends at ${ends[info.tag]} but also begins at $begin",
      );
      final previousAnimatable = animatables[info.tag]!;
      animatables[info.tag] = info.createIntervalAnimatable(
        animatable: previousAnimatable,
        defaultAnimatable: info.animatable.chainCurve(intervalCurve),
        begin: begins[info.tag]!,
        end: ends[info.tag]!,
      );
      ends[info.tag] = end;
    }
  }

  Map<SequenceAnimationTag, Animation> getAnimations() {
    Map<SequenceAnimationTag, Animation> result = {};
    animatables.forEach((tag, animInfo) {
      result[tag] = animInfo.animate(animationController);
    });
    return result;
  }
}

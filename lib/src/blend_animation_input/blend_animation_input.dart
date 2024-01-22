import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/box_info.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

export 'character_animation_input.dart';
export 'widget_animation_input.dart';

abstract class BlendAnimationInput<G> {
  Iterable<G> get groups;

  @nonVirtual
  late final List<AnimationProperty> animationProperties =
      groups.map((e) => AnimationProperty()).toList(growable: false);

  GroupDetails<G> getAnimationGroupDetails(
      BuildContext context, BoxConstraints constraints);

  Widget renderGroupItem(AnimationBoxInfo<G> info);

  Alignment get alignment => Alignment.center;

  @nonVirtual
  Positioned renderAnimation(AnimationBoxInfo<G> info, Movie movie) {
    final animationProperty = animationProperties.elementAt(info.index);
    final insets = animationProperty.rectangularMask.fromOrDefault(movie);
    return Positioned(
      top: info.rect.top,
      left: info.rect.left,
      child: ClipRect(
        clipBehavior: insets == EdgeInsets.zero ? Clip.none : Clip.hardEdge,
        clipper: RectangleClipper(insets),
        child: Opacity(
          opacity: animationProperty.opacity.fromOrDefault(movie).clamp(0, 1),
          child: Transform(
            alignment: animationProperty.transformation
                .fromOrDefault(movie)
                .transformAlignment,
            transform:
                animationProperty.transformation.fromOrDefault(movie).matrix,
            child: renderGroupItem(info),
          ),
        ),
      ),
    );
  }
}

/// Only used for calculation purposes
class DummyAnimationInput extends BlendAnimationInput {
  final int groupLength;

  DummyAnimationInput({required this.groupLength})
      : groups = Iterable.generate(groupLength);

  @override
  final Iterable groups;

  Duration calculateDuration(PipelineStep steps) {
    return BlendAnimationBuilder(this).add(steps).tween.duration;
  }

  @override
  GroupDetails getAnimationGroupDetails(
      BuildContext context, BoxConstraints constraints) {
    return const GroupDetails(Size.zero, []);
  }

  @override
  Widget renderGroupItem(AnimationBoxInfo info) {
    return const SizedBox.shrink();
  }
}

class RectangleClipper extends CustomClipper<Rect> {
  final EdgeInsets insets;

  const RectangleClipper(this.insets);

  @override
  Rect getClip(Size size) {
    final w = size.width;
    final h = size.height;
    return Rect.fromLTRB(
      w * insets.left,
      h * insets.top,
      w - w * insets.right,
      h - h * insets.top,
    );
  }

  @override
  bool shouldReclip(covariant RectangleClipper oldClipper) =>
      insets != oldClipper.insets;
}

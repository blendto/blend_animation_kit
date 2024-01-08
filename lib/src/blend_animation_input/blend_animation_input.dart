import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/box_info.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:simple_animations/simple_animations.dart';

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
    return Positioned(
      top: info.rect.top,
      left: info.rect.left,
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
    );
  }
}

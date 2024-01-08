import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/box_info.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';

class WidgetAnimationInput extends BlendAnimationInput<Widget> {
  final Widget widget;
  final Size size;

  WidgetAnimationInput({
    required this.widget,
    required this.size,
  });

  @override
  GroupDetails<Widget> getAnimationGroupDetails(
      BuildContext context, BoxConstraints constraints) {
    final boxes = groups.mapIndexed((index, e) {
      return AnimationBoxInfo(
        subject: e,
        rect: Offset.zero & size,
        index: index,
      );
    }).toList(growable: false);
    return GroupDetails(size, boxes);
  }

  @override
  Iterable<Widget> get groups => [widget];

  @override
  Widget renderGroupItem(AnimationBoxInfo<Widget> info) {
    return SizedBox.fromSize(
      size: info.rect.size,
      child: widget,
    );
  }
}

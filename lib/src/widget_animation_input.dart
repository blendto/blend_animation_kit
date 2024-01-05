import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/box_info.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';

class WidgetAnimationInput
    extends AnimationInput<List<Widget>, AnimationBoxInfo> {
  final Widget widget;
  final Size size;

  WidgetAnimationInput({
    required this.widget,
    required this.size,
  });

  @override
  ({Iterable<AnimationBoxInfo> boxes, Size overallBoxSize})
      getAnimationGroupDetails(
          BuildContext context, BoxConstraints constraints) {
    final boxes = groups.mapIndexed((index, e) {
      return AnimationBoxInfo(rect: Offset.zero & size, index: index);
    }).toList(growable: false);
    return (boxes: boxes, overallBoxSize: size);
  }

  @override
  List<Widget> get groups => [widget];

  @override
  Widget renderGroupItem(AnimationBoxInfo info) {
    return SizedBox.fromSize(
      size: info.rect.size,
      child: widget,
    );
  }
}

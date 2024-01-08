import 'dart:ui';

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/box_info.dart';
import 'package:blend_animation_kit/src/extensions.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';

class CharacterAnimationInput extends BlendAnimationInput<String> {
  final String text;

  final TextAlign textAlign;

  final TextStyle? textStyle;

  @override
  Alignment get alignment => textAlign.toAlignment();

  @override
  final Iterable<String> groups;

  @override
  GroupDetails<String> getAnimationGroupDetails(
      BuildContext context, BoxConstraints constraints) {
    final defaultTextStyle = DefaultTextStyle.of(context);
    final textStyle = defaultTextStyle.style.merge(this.textStyle);
    final textPainter = TextPainter(
      text: TextSpan(text: text, style: textStyle),
      textDirection: TextDirection.ltr,
      textAlign: textAlign,
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: defaultTextStyle.maxLines,
      textWidthBasis: defaultTextStyle.textWidthBasis,
      textHeightBehavior: defaultTextStyle.textHeightBehavior ??
          DefaultTextHeightBehavior.maybeOf(context),
    );
    textPainter.layout(maxWidth: constraints.maxWidth);

    final boxes = <AnimationBoxInfo<String>>[];
    int charOffset = 0;
    text.characters.forEachIndexed((i, char) {
      final selectionRects = textPainter.getBoxesForSelection(
        TextSelection(
            baseOffset: charOffset, extentOffset: charOffset + char.length),
        boxHeightStyle: BoxHeightStyle.max,
        boxWidthStyle: BoxWidthStyle.max,
      );
      charOffset += char.length;
      if (selectionRects.isNotEmpty) {
        boxes.add(
          AnimationBoxInfo(
            subject: char,
            index: i,
            rect: selectionRects.first.toRect(),
          ),
        );
      }
    });
    final boxSize = textPainter.size;
    textPainter.dispose();
    return GroupDetails(boxSize, boxes);
  }

  @override
  Widget renderGroupItem(AnimationBoxInfo<String> info) {
    return Text.rich(
      TextSpan(text: info.subject),
      style: textStyle,
    );
  }

  CharacterAnimationInput({
    required this.text,
    this.textAlign = TextAlign.left,
    this.textStyle,
  }) : groups = text.characters;
}

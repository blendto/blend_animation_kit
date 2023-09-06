import 'package:flutter/material.dart';

class Matrix4WithAlignment {
  final Matrix4 matrix;
  final AlignmentGeometry transformAlignment;

  const Matrix4WithAlignment(
      {required this.matrix, required this.transformAlignment});
}

class Matrix4WithAlignmentTween extends Tween<Matrix4WithAlignment> {
  final AlignmentGeometry transformAlignment;

  final Matrix4Tween matrix4Tween;

  Matrix4WithAlignmentTween({
    required Matrix4 begin,
    required Matrix4 end,
    required this.transformAlignment,
  })  : matrix4Tween = Matrix4Tween(begin: begin, end: end),
        super(
          begin: Matrix4WithAlignment(
              matrix: begin, transformAlignment: transformAlignment),
          end: Matrix4WithAlignment(
              matrix: end, transformAlignment: transformAlignment),
        );

  @override
  Matrix4WithAlignment lerp(double t) {
    return Matrix4WithAlignment(
        matrix: matrix4Tween.lerp(t), transformAlignment: transformAlignment);
  }
}

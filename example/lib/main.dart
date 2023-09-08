import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData.dark(
        useMaterial3: true,
      ),
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  List<Widget> get widgets => [
        variant2(customText ?? "Great Thinkers", const TextStyle(fontSize: 40)),
        variant3(
            customText ?? "Coffee mornings", const TextStyle(fontSize: 30)),
        variant4(
            customText ?? "Beautiful Questions", const TextStyle(fontSize: 30)),
        variant5(customText ?? "Animation 6", const TextStyle(fontSize: 40)),
        variant6(customText ?? "Animation 7", const TextStyle(fontSize: 40)),
        variant7(["Get", "Ready", "For", customText ?? "This"],
            const TextStyle(fontSize: 40)),
      ];

  String? customText;
  final textFieldController = TextEditingController();

  @override
  void dispose() {
    textFieldController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            children: [
              TextField(
                controller: textFieldController,
                decoration: InputDecoration(
                  hintText: "Enter any text",
                  suffixIcon: TextButton.icon(
                    onPressed: () {
                      if (!mounted) return;
                      setState(() {
                        customText = null;
                      });
                      textFieldController.clear();
                      FocusManager.instance.primaryFocus?.unfocus();
                    },
                    icon: const Icon(Icons.cancel),
                    label: const Text("Cancel"),
                  ),
                ),
                onChanged: (val) {
                  if (!mounted) return;
                  setState(() {
                    customText = val;
                  });
                },
              ),
              Expanded(
                child: Scrollbar(
                  child: ListView.separated(
                    key: ValueKey(customText),
                    padding: const EdgeInsets.all(10),
                    separatorBuilder: (context, index) => const SizedBox(
                      height: 10,
                    ),
                    itemCount: widgets.length,
                    itemBuilder: (context, index) {
                      return Center(
                        child: Container(
                          decoration: BoxDecoration(
                              border: Border.all(color: Colors.red)),
                          child: widgets[index],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

package androidx.test.platform.app;
/** Stub mínimo de androidx.test (indisponível sem o Google Maven). Só usado nos testes JVM. */
public final class InstrumentationRegistry {
    private static android.app.Instrumentation instrumentation; private static android.os.Bundle args;
    public static void registerInstance(android.app.Instrumentation i, android.os.Bundle b) { instrumentation = i; args = b; }
    public static android.app.Instrumentation getInstrumentation() { return instrumentation; }
    public static android.os.Bundle getArguments() { return args; }
}

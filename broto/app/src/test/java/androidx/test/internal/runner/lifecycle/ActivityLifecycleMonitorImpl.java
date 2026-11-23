package androidx.test.internal.runner.lifecycle;
import androidx.test.runner.lifecycle.*;
import java.util.*;
public class ActivityLifecycleMonitorImpl implements ActivityLifecycleMonitor {
    private final Map<android.app.Activity, Stage> stages = new LinkedHashMap<>();
    private final List<ActivityLifecycleCallback> callbacks = new ArrayList<>();
    public ActivityLifecycleMonitorImpl() {}
    public ActivityLifecycleMonitorImpl(boolean declawThreadCheck) {}
    public void signalLifecycleChange(Stage stage, android.app.Activity a) {
        if (stage == Stage.DESTROYED) stages.remove(a); else stages.put(a, stage);
        for (ActivityLifecycleCallback cb : new ArrayList<>(callbacks)) cb.onActivityLifecycleChanged(a, stage);
    }
    public void addLifecycleCallback(ActivityLifecycleCallback cb) { callbacks.add(cb); }
    public void removeLifecycleCallback(ActivityLifecycleCallback cb) { callbacks.remove(cb); }
    public Stage getLifecycleStageOf(android.app.Activity a) { return stages.get(a); }
    public Collection<android.app.Activity> getActivitiesInStage(Stage s) {
        List<android.app.Activity> r = new ArrayList<>();
        for (Map.Entry<android.app.Activity, Stage> e : stages.entrySet()) if (e.getValue() == s) r.add(e.getKey());
        return r;
    }
}

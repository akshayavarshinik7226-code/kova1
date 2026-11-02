import os
import tempfile

TMP = tempfile.mkdtemp(prefix="kova-test-")
os.environ["KOVA_DATA_DIR"] = TMP
os.environ["KOVA_SECRET_KEY"] = "test-secret-key-for-kova-suite"
os.environ["KOVA_SEED_DEMO_DATA"] = "1"

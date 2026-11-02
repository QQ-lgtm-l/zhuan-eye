import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;

/** 本地验证用：只读查询 / 执行 SQL 文件，避免依赖 mysql 客户端。 */
public class DshDb {
    private static final String URL = "jdbc:mysql://localhost:3306/yoloai?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false";
    private static final String USER = "root";
    private static final String PASS = "123456";

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.out.println("usage: query <sql> | exec <file>");
            return;
        }
        try (Connection conn = DriverManager.getConnection(URL, USER, PASS)) {
            if ("query".equals(args[0])) {
                try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(args[1])) {
                    ResultSetMetaData md = rs.getMetaData();
                    int n = md.getColumnCount();
                    for (int i = 1; i <= n; i++) {
                        if (i > 1) System.out.print("\t");
                        System.out.print(md.getColumnLabel(i));
                    }
                    System.out.println();
                    while (rs.next()) {
                        for (int i = 1; i <= n; i++) {
                            if (i > 1) System.out.print("\t");
                            System.out.print(rs.getString(i));
                        }
                        System.out.println();
                    }
                }
            } else if ("exec".equals(args[0])) {
                String sql = Files.readString(Path.of(args[1]), StandardCharsets.UTF_8);
                try (Statement st = conn.createStatement()) {
                    for (String part : sql.split(";\\s*(?:\\r?\\n|$)")) {
                        String s = part.trim();
                        if (!s.isEmpty()) {
                            st.execute(s);
                        }
                    }
                }
                System.out.println("exec ok");
            }
        }
    }
}

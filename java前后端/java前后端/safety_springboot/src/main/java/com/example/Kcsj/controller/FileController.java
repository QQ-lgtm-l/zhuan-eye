package com.example.Kcsj.controller;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.example.Kcsj.common.Result;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/files")
public class FileController {
    @Value("${server.port}")
    private String port;

    @Value("${file.ip}")
    private String ip;

    // 单文件上传接口（按请求地址返回可访问的 URL，手机/局域网也能用）
    @PostMapping("/upload")
    public Result<?> upload(MultipartFile file, HttpServletRequest request) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String flag = IdUtil.fastSimpleUUID();
        String rootFilePath = System.getProperty("user.dir") + "/files/" + flag + "_" + originalFilename;
        File saveFile = new File(rootFilePath);
        if (!saveFile.getParentFile().exists()) {
            saveFile.getParentFile().mkdirs();
        }
        FileUtil.writeBytes(file.getBytes(), rootFilePath);
        String fileUrl = requestBaseUrl(request) + "/files/" + flag + "_" + originalFilename;
        return Result.success(fileUrl);
    }

    private String requestBaseUrl(HttpServletRequest request) {
        String host = request.getHeader("X-Forwarded-Host");
        if (StrUtil.isBlank(host)) {
            host = request.getServerName();
        }
        int requestPort = request.getServerPort();
        boolean defaultPort = ("http".equalsIgnoreCase(request.getScheme()) && requestPort == 80)
                || ("https".equalsIgnoreCase(request.getScheme()) && requestPort == 443);
        return request.getScheme() + "://" + host + (defaultPort ? "" : ":" + requestPort);
    }

    // 文件夹上传接口
    @PostMapping("/uploadFolder")
    public Result<?> uploadFolder(MultipartFile folder, HttpServletRequest request) throws IOException {
        if (folder == null || !folder.getOriginalFilename().endsWith(".zip")) {
            return Result.error("-1", "请上传有效的zip文件");
        }

        String flag = IdUtil.fastSimpleUUID();
        String basePath = System.getProperty("user.dir") + "/files/" + flag + "/";
        File baseDir = new File(basePath);
        if (!baseDir.exists()) {
            baseDir.mkdirs();
        }

        try (ZipInputStream zis = new ZipInputStream(folder.getInputStream())) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (!entry.isDirectory()) {
                    Path filePath = Paths.get(basePath, entry.getName());
                    Files.createDirectories(filePath.getParent());
                    Files.copy(zis, filePath);
                }
                zis.closeEntry();
            }
        }

        String folderUrl = requestBaseUrl(request) + "/files/" + flag;
        return Result.success(folderUrl);
    }

    // 下载接口：支持文件夹下载和单文件下载
    @GetMapping("/{flag}/{filename:.+}")
    public void getFileFromFolder(@PathVariable String flag, @PathVariable String filename, HttpServletResponse response) {
        String basePath = System.getProperty("user.dir") + "/files/";
        String folderPath = basePath + flag + "/";
        String filePath = folderPath + filename;
        File file = new File(filePath);

        try {
            if (file.exists() && file.isFile()) {
                // 下载文件夹中的指定文件
                response.addHeader("Content-Disposition", "attachment;filename=" + URLEncoder.encode(filename, "UTF-8"));
                response.setContentType("application/octet-stream");
                byte[] bytes = FileUtil.readBytes(file);
                try (OutputStream os = response.getOutputStream()) {
                    os.write(bytes);
                    os.flush();
                }
            } else {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            }
        } catch (IOException e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    // 原有的下载接口：支持文件夹打包下载或单文件下载
    @GetMapping("/{flag}")
    public void getFiles(@PathVariable String flag, HttpServletResponse response) {
        String basePath = System.getProperty("user.dir") + "/files/";
        String folderPath = basePath + flag + "/";
        File folder = new File(folderPath);

        try {
            if (folder.exists() && folder.isDirectory()) {
                // 处理文件夹下载：打包成zip
                File[] files = folder.listFiles();
                if (files != null && files.length > 0) {
                    response.setContentType("application/zip");
                    response.addHeader("Content-Disposition", "attachment;filename=" + URLEncoder.encode(flag + ".zip", "UTF-8"));

                    try (OutputStream os = response.getOutputStream();
                         ZipOutputStream zos = new ZipOutputStream(os)) {
                        for (File file : files) {
                            if (file.isFile()) {
                                ZipEntry zipEntry = new ZipEntry(file.getName());
                                zos.putNextEntry(zipEntry);
                                byte[] bytes = FileUtil.readBytes(file);
                                zos.write(bytes);
                                zos.closeEntry();
                            }
                        }
                        zos.finish();
                    }
                } else {
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                }
            } else {
                // 处理单文件下载
                String filePath = basePath + flag;
                File file = new File(filePath);
                if (file.exists() && file.isFile()) {
                    response.addHeader("Content-Disposition", "attachment;filename=" + URLEncoder.encode(file.getName(), "UTF-8"));
                    response.setContentType("application/octet-stream");
                    byte[] bytes = FileUtil.readBytes(file);
                    try (OutputStream os = response.getOutputStream()) {
                        os.write(bytes);
                        os.flush();
                    }
                } else {
                    // 检查是否有带前缀的文件
                    List<String> fileNames = FileUtil.listFileNames(basePath);
                    String matchedFile = fileNames.stream().filter(name -> name.startsWith(flag + "_")).findFirst().orElse("");
                    if (StrUtil.isNotEmpty(matchedFile)) {
                        file = new File(basePath + matchedFile);
                        response.addHeader("Content-Disposition", "attachment;filename=" + URLEncoder.encode(matchedFile, "UTF-8"));
                        response.setContentType("application/octet-stream");
                        byte[] bytes = FileUtil.readBytes(file);
                        try (OutputStream os = response.getOutputStream()) {
                            os.write(bytes);
                            os.flush();
                        }
                    } else {
                        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                        response.getWriter().write("File or folder not found");
                    }
                }
            }
        } catch (IOException e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }
}
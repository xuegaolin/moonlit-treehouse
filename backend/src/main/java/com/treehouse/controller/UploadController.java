package com.treehouse.controller;

import com.treehouse.common.BaseController;
import com.treehouse.common.BizException;
import com.treehouse.common.R;
import com.treehouse.common.ResultCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 通用文件上传控制器
 *
 * <p>接收小程序 canvasToTempFilePath 生成的临时图片，保存到服务端静态目录。
 * 保存路径：{upload-dir}/yyyyMM/uuid.ext</p>
 */
@Slf4j
@RestController
@RequestMapping("/upload")
public class UploadController extends BaseController {

    /** 上传文件保存根目录（默认 ./uploads，可用环境变量 UPLOAD_DIR 覆盖） */
    @Value("${treehouse.upload-dir:./uploads}")
    private String uploadDir;

    /** 图片访问 URL 前缀（生产环境应配 CDN / Nginx 静态映射） */
    @Value("${treehouse.upload-url-prefix:/uploads}")
    private String urlPrefix;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    private static final String[] ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"};

    /**
     * 上传证书图片
     *
     * <p>POST /api/v1/upload/image
     * Content-Type: multipart/form-data
     *
     * @param file     图片文件（png/jpg/webp，≤10MB）
     * @param bizType  业务类型：bailan / letter / tarot / avatar 等
     * @param bizId    关联业务 ID（如许可证 licenseNo），可选
     * @return { url, filename }
     */
    @PostMapping("/image")
    public R<Map<String, String>> uploadImage(
            HttpServletRequest request,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "bizType", defaultValue = "general") String bizType,
            @RequestParam(value = "bizId", required = false) String bizId) {

        Long userId = currentUserId(request);
        log.info("图片上传：userId={}, bizType={}, bizId={}, size={}",
                userId, bizType, bizId, file.getSize());

        // 1. 校验
        if (file.isEmpty()) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "文件不能为空");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "图片不能超过 10MB");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null) originalName = "image.png";
        String ext = extractExtension(originalName);
        if (!isAllowedExtension(ext)) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(),
                    "仅支持 png/jpg/webp 格式");
        }

        // 2. 生成存储路径：{uploadDir}/{bizType}/{yyyyMM}/{uuid}{ext}
        String monthDir = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        String filename = UUID.randomUUID().toString().replace("-", "") + ext;
        Path dirPath = Paths.get(uploadDir, bizType, monthDir);
        Path filePath = dirPath.resolve(filename);

        // 3. 保存文件
        try {
            Files.createDirectories(dirPath);
            file.transferTo(filePath.toFile());
        } catch (IOException e) {
            log.error("图片保存失败：{}", e.getMessage(), e);
            throw new BizException(ResultCode.INTERNAL_ERROR.getCode(), "图片保存失败");
        }

        // 4. 返回可访问 URL
        String url = urlPrefix + "/" + bizType + "/" + monthDir + "/" + filename;
        log.info("图片上传成功：{} → {}", originalName, url);

        Map<String, String> data = new HashMap<>();
        data.put("url", url);
        data.put("filename", filename);
        return R.ok(data);
    }

    private String extractExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot).toLowerCase() : ".png";
    }

    private boolean isAllowedExtension(String ext) {
        for (String allowed : ALLOWED_EXTENSIONS) {
            if (allowed.equals(ext)) return true;
        }
        return false;
    }
}
